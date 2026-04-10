"""Transcript fetching service — YouTube, Apple Podcasts, and Substack.

YouTube fallback chain:
  1. youtube_transcript_api  — free, instant; requires captions to exist on the video
  2. Supadata API            — handles any public YouTube video, generates transcript from audio

Apple Podcasts:
  1. iTunes API → RSS feed URL
  2. RSS parsing → <podcast:transcript> tag → fetch VTT or HTML transcript

Substack:
  1. Fetch page HTML → extract embedded transcript JSON from <script> tags
  2. Fall back to audio URL + Supadata if no embedded transcript
"""

import re
import json
import httpx
from typing import Optional
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
)


class TranscriptError(Exception):
    pass


def _extract_video_id(url: str) -> Optional[str]:
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


# ─── Method 1: youtube_transcript_api (free, instant) ─────────────────────────

def _fetch_via_caption_api(video_id: str) -> Optional[dict]:
    """Returns transcript dict on success, None if no captions available.
    Raises TranscriptError for hard failures (video unavailable, bad ID, etc.)."""
    try:
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
        transcript = None
        try:
            transcript = transcript_list.find_manually_created_transcript(['en'])
        except NoTranscriptFound:
            try:
                transcript = transcript_list.find_generated_transcript(['en'])
            except NoTranscriptFound:
                available = (
                    transcript_list._manually_created_transcripts
                    or transcript_list._generated_transcripts
                )
                if available:
                    transcript = list(available.values())[0]

        if transcript is None:
            return None

        data = transcript.fetch()
        segments = [{"start": e["start"], "text": e["text"]} for e in data]
        full_text = " ".join(e["text"] for e in data)
        return {"text": full_text, "segments": segments, "source": "captions"}

    except VideoUnavailable:
        raise TranscriptError(
            f"Video {video_id} is unavailable. "
            "Check the URL is correct and the video is publicly accessible."
        )
    except (TranscriptsDisabled, NoTranscriptFound):
        return None  # soft failure — try Supadata
    except Exception as e:
        msg = str(e).lower()
        if any(x in msg for x in ("disabled", "no transcript", "could not retrieve", "subtitles", "no element found", "xml", "parseerror", "failed to fetch")):
            return None  # soft failure — try Supadata
        raise TranscriptError(f"Caption API error for {video_id}: {e}")


# ─── Method 2: Supadata (handles any public YouTube video) ────────────────────

async def _fetch_via_supadata(video_id: str) -> dict:
    """Fetch transcript from Supadata API — works even without captions."""
    import httpx
    from config import settings

    if not settings.supadata_api_key:
        raise TranscriptError(
            "No captions found for this video and SUPADATA_API_KEY is not configured. "
            "Add your Supadata API key to enable fallback transcription."
        )

    url = f"https://api.supadata.ai/v1/youtube/transcript"
    params = {"videoId": video_id, "text": "true"}
    headers = {"x-api-key": settings.supadata_api_key}

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            r = await client.get(url, params=params, headers=headers)
        except Exception as e:
            raise TranscriptError(f"Supadata request failed: {e}")

    if r.status_code == 402:
        raise TranscriptError("Supadata quota exceeded. Check your plan at supadata.ai.")
    if r.status_code == 404:
        raise TranscriptError(
            f"Supadata could not find a transcript for video {video_id}. "
            "The video may be private, age-restricted, or too new."
        )
    if not r.is_success:
        raise TranscriptError(f"Supadata error {r.status_code}: {r.text[:200]}")

    data = r.json()

    # Supadata returns either:
    #   { "content": "full text", "segments": [{"text": ..., "offset": ..., "duration": ...}] }
    # or just { "content": "full text" } depending on the endpoint
    content = data.get("content") or data.get("transcript") or ""
    raw_segments = data.get("segments") or []

    segments = [
        {
            "start": float(s.get("offset", s.get("start", 0))) / 1000
                     if s.get("offset") is not None else float(s.get("start", 0)),
            "text": s.get("text", ""),
        }
        for s in raw_segments
    ]

    # If no segments returned, create a single segment from full text
    if not segments and content:
        segments = [{"start": 0.0, "text": content}]

    return {"text": content, "segments": segments, "source": "supadata"}


# ─── Public API ───────────────────────────────────────────────────────────────

def fetch_youtube_transcript(url: str) -> dict:
    """Fetch transcript for a YouTube URL.

    Called via asyncio.to_thread() from the FastAPI endpoint.
    Tries captions first; falls back to Supadata if unavailable.
    """
    import asyncio

    video_id = _extract_video_id(url)
    if not video_id:
        raise TranscriptError(
            f"Invalid YouTube URL: {url}. "
            "Expected format: https://youtube.com/watch?v=VIDEO_ID"
        )

    # 1. Try free caption API
    result = _fetch_via_caption_api(video_id)
    if result is not None:
        return result

    # 2. Fall back to Supadata
    loop = asyncio.new_event_loop()
    try:
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(_fetch_via_supadata(video_id))
    finally:
        loop.close()


# ─── Apple Podcasts ───────────────────────────────────────────────────────────

def _is_apple_podcast_url(url: str) -> bool:
    return "podcasts.apple.com" in url


def _parse_apple_podcast_url(url: str) -> tuple[str, Optional[str]]:
    """Return (show_id, episode_id) from an Apple Podcasts URL.
    Episode ID is the ?i= query param. Returns (show_id, None) for show-level URLs."""
    show_match = re.search(r'/id(\d+)', url)
    if not show_match:
        raise TranscriptError("Could not parse Apple Podcasts URL — expected format: podcasts.apple.com/…/idSHOW_ID?i=EPISODE_ID")
    show_id = show_match.group(1)
    episode_match = re.search(r'[?&]i=(\d+)', url)
    episode_id = episode_match.group(1) if episode_match else None
    return show_id, episode_id


def _parse_vtt(vtt_text: str) -> dict:
    """Parse WebVTT transcript into {text, segments} format."""
    segments = []
    lines = vtt_text.strip().splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        # Match timestamp lines like "00:00:01.000 --> 00:00:05.000"
        ts_match = re.match(r'(\d+:\d+:\d+[\.,]\d+)\s+-->\s+(\d+:\d+:\d+[\.,]\d+)', line)
        if ts_match:
            def _ts_to_sec(ts):
                ts = ts.replace(',', '.')
                parts = ts.split(':')
                h, m, s = int(parts[0]), int(parts[1]), float(parts[2])
                return h * 3600 + m * 60 + s
            start = _ts_to_sec(ts_match.group(1))
            i += 1
            text_parts = []
            while i < len(lines) and lines[i].strip():
                text_parts.append(lines[i].strip())
                i += 1
            text = ' '.join(text_parts)
            # Strip VTT tags like <c>, <b>, speaker annotations
            text = re.sub(r'<[^>]+>', '', text).strip()
            if text:
                segments.append({"start": start, "text": text})
        i += 1
    full_text = ' '.join(s['text'] for s in segments)
    return {"text": full_text, "segments": segments, "source": "apple_podcast_vtt"}


def _parse_html_transcript(html: str) -> dict:
    """Parse Buzzsprout-style HTML transcript into {text, segments} format."""
    # Strip all HTML tags
    text = re.sub(r'<[^>]+>', ' ', html)
    # Collapse whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    # No timing info available from HTML transcripts
    segments = [{"start": 0.0, "text": text}]
    return {"text": text, "segments": segments, "source": "apple_podcast_html"}


def fetch_apple_podcast_transcript(url: str) -> dict:
    """Fetch transcript for an Apple Podcasts episode URL.

    Flow:
    1. Parse URL → show_id, episode_id
    2. iTunes API → RSS feed URL + episode title
    3. Parse RSS → find matching episode → get transcript URL
    4. Fetch and parse transcript (VTT or HTML)
    """
    show_id, episode_id = _parse_apple_podcast_url(url)

    headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}

    # Step 1: Get RSS feed URL and show name from iTunes
    try:
        r = httpx.get(
            f"https://itunes.apple.com/lookup?id={show_id}&entity=podcast",
            timeout=10.0
        )
        r.raise_for_status()
        itunes_data = r.json()
    except Exception as e:
        raise TranscriptError(f"iTunes API lookup failed: {e}")

    results = itunes_data.get("results", [])
    if not results:
        raise TranscriptError(f"Podcast not found on iTunes (show_id={show_id})")

    rss_url = results[0].get("feedUrl")
    show_name = results[0].get("collectionName", "")
    if not rss_url:
        raise TranscriptError(f"No RSS feed URL found for podcast '{show_name}'")

    # Step 2: Get episode title from iTunes if we have an episode ID
    episode_title = None
    if episode_id:
        try:
            ep_r = httpx.get(
                f"https://itunes.apple.com/lookup?id={show_id}&entity=podcastEpisode&limit=200",
                timeout=10.0
            )
            if ep_r.is_success:
                ep_data = ep_r.json()
                for ep in ep_data.get("results", []):
                    if str(ep.get("trackId", "")) == episode_id:
                        episode_title = ep.get("trackName")
                        break
        except Exception:
            pass  # Non-fatal — will match by position if title not found

    # Step 3: Fetch and parse RSS feed
    try:
        rss_r = httpx.get(rss_url, headers=headers, timeout=15.0, follow_redirects=True)
        rss_r.raise_for_status()
        rss_text = rss_r.text
    except Exception as e:
        raise TranscriptError(f"Could not fetch RSS feed: {e}")

    # Step 4: Find matching episode item
    items = rss_text.split('<item>')
    if len(items) < 2:
        raise TranscriptError("RSS feed has no episodes")

    target_item = None
    if episode_title:
        # Match by title
        title_slug = re.sub(r'[^a-z0-9]', '', episode_title.lower())
        for item in items[1:]:
            item_title_match = re.search(r'<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</title>', item)
            if item_title_match:
                item_title = re.sub(r'[^a-z0-9]', '', item_title_match.group(1).lower())
                if item_title == title_slug or title_slug in item_title or item_title in title_slug:
                    target_item = item
                    break

    # Fall back to most recent episode if no match
    if target_item is None:
        target_item = items[1]

    # Step 5: Get transcript URL from item
    transcript_match = re.search(
        r'<podcast:transcript\s+url="([^"]+)"\s+type="([^"]+)"',
        target_item
    )
    if not transcript_match:
        # Also try reversed attribute order
        transcript_match = re.search(
            r'<podcast:transcript[^>]+url="([^"]+)"[^>]*/?>',
            target_item
        )
        if not transcript_match:
            # Get episode title for error message
            title_m = re.search(r'<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</title>', target_item)
            ep_name = title_m.group(1) if title_m else "this episode"
            raise TranscriptError(
                f"No transcript available for '{ep_name}'. "
                "This show does not publish transcripts in its RSS feed. "
                "Try a YouTube URL instead, or wait for Listen Notes integration."
            )

    transcript_url = transcript_match.group(1)
    transcript_type = transcript_match.group(2) if transcript_match.lastindex >= 2 else "text/vtt"

    # Step 6: Fetch transcript
    try:
        tr = httpx.get(transcript_url, headers=headers, timeout=20.0, follow_redirects=True)
        tr.raise_for_status()
        transcript_content = tr.text
    except Exception as e:
        raise TranscriptError(f"Could not fetch transcript file: {e}")

    # Step 7: Parse by type
    if "vtt" in transcript_type or "vtt" in transcript_url.lower():
        return _parse_vtt(transcript_content)
    else:
        # HTML or unknown — strip tags
        return _parse_html_transcript(transcript_content)


# ─── Substack Podcasts ────────────────────────────────────────────────────────

def _is_substack_url(url: str) -> bool:
    """Detect Substack podcast pages.

    Handles both:
    - substack.com/p/<slug>  (native domain)
    - custom domains like peoplevsalgorithms.com/p/<slug>

    We detect /p/ paths and then confirm the page is Substack by checking for
    Substack metadata in the fetched HTML. A bare URL check isn't enough because
    custom Substack domains don't contain "substack" in the host.
    """
    return bool(re.search(r'/p/[a-z0-9_-]+', url, re.IGNORECASE))



def _parse_substack_preloads(html: str) -> Optional[dict]:
    """Extract and parse the window._preloads JSON from a Substack page.

    Substack injects page data as:
        window._preloads = JSON.parse("{...double-escaped JSON...}");

    The inner string uses \\\" for quotes and \\\\\\\\ for backslashes.
    """
    idx = html.find('window._preloads')
    if idx < 0:
        return None
    parse_idx = html.find('JSON.parse(', idx)
    if parse_idx < 0:
        return None

    # Content starts after JSON.parse( — skip the opening "
    content_start = parse_idx + len('JSON.parse(')
    if html[content_start] != '"':
        return None

    # Scan for the closing "); skipping over escaped characters
    pos = content_start + 1
    while pos < len(html):
        ch = html[pos]
        if ch == '\\':
            pos += 2  # skip escaped char
            continue
        if ch == '"':
            break
        pos += 1

    raw_escaped = html[content_start + 1:pos]
    if not raw_escaped:
        return None

    try:
        # Decode the double-escaped JSON string: \\\" → \", \\\\ → \\
        decoded = raw_escaped.replace('\\"', '"').replace('\\\\', '\\')
        return json.loads(decoded)
    except (json.JSONDecodeError, Exception):
        return None


def _extract_substack_audio_url(html: str) -> Optional[str]:
    """Extract the podcast audio URL from a Substack page.

    Primary: parse window._preloads and read post.podcast_url.
    Fallback: regex for Substack audio API URLs in the raw HTML.
    """
    # Primary: structured data
    data = _parse_substack_preloads(html)
    if data:
        post = data.get("post") or {}
        audio_url = post.get("podcast_url")
        if audio_url and "substack.com" in audio_url:
            return audio_url

    # Fallback: regex for the audio API URL pattern
    match = re.search(
        r'https://api\.substack\.com/api/v1/audio/upload/[0-9a-f-]{36}/src',
        html,
    )
    if match:
        return match.group(0)

    return None


def fetch_substack_transcript(url: str) -> dict:
    """Fetch transcript for a Substack podcast episode URL.

    Flow:
    1. Fetch the page HTML
    2. Confirm it's a Substack page (substackcdn.com assets present)
    3. Extract audio URL from window._preloads → post.podcast_url
    4. Send audio URL to Supadata for transcription (requires SUPADATA_API_KEY)
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    try:
        resp = httpx.get(url, headers=headers, timeout=20.0, follow_redirects=True)
        resp.raise_for_status()
        html = resp.text
    except Exception as e:
        raise TranscriptError(f"Could not fetch Substack page: {e}")

    # Confirm this is a Substack page (native or custom domain)
    is_substack = (
        "substack.com" in resp.url.host
        or "substackcdn.com" in html          # CDN assets on all Substack pages
        or "window._preloads" in html         # Substack's data injection pattern
    )
    if not is_substack:
        raise TranscriptError(
            f"This doesn't appear to be a Substack page: {url}. "
            "Try the YouTube or Apple Podcasts URL for this episode instead."
        )

    # Extract audio URL
    audio_url = _extract_substack_audio_url(html)

    title_match = re.search(r'<title[^>]*>([^<]+)</title>', html)
    ep_title = title_match.group(1).strip() if title_match else url

    if not audio_url:
        raise TranscriptError(
            f"No podcast audio found on '{ep_title}'. "
            "This may not be a podcast episode page. "
            "Try the YouTube or Apple Podcasts URL for this episode instead."
        )

    # Substack stores transcripts in a private S3 bucket — we have to transcribe
    # from the audio URL using a speech-to-text service.
    # Supadata only handles YouTube; for audio files we need AssemblyAI / Deepgram / Whisper.
    raise TranscriptError(
        f"Found audio for '{ep_title}' but Substack audio transcription is not yet supported. "
        "Substack stores transcripts privately and Supadata only handles YouTube URLs. "
        "To transcribe this episode, use the YouTube link if available, or paste the Apple Podcasts URL."
    )


# ─── Unified fetch router ─────────────────────────────────────────────────────

def fetch_transcript(url: str) -> dict:
    """Route to the correct transcript fetcher based on URL type.

    Priority:
    1. Apple Podcasts — podcasts.apple.com
    2. YouTube — youtube.com / youtu.be
    3. Substack — /p/<slug> paths (including custom domains)
    """
    if _is_apple_podcast_url(url):
        return fetch_apple_podcast_transcript(url)
    if _extract_video_id(url):
        return fetch_youtube_transcript(url)
    if _is_substack_url(url):
        return fetch_substack_transcript(url)
    raise TranscriptError(
        f"Unsupported URL: {url}. "
        "Supported sources: YouTube, Apple Podcasts, Substack podcast pages."
    )


# ─── Take extraction ──────────────────────────────────────────────────────────

async def extract_podcast_takes(transcript: dict, count: int = 5, model: str | None = None) -> list[dict]:
    """Extract interesting claims from a podcast transcript using LLM analysis."""
    from pipeline import _call
    from prompts import get_prompt

    if not isinstance(transcript, dict):
        raise ValueError("Transcript must be a dictionary")
    if "text" not in transcript or "segments" not in transcript:
        raise ValueError("Transcript must contain 'text' and 'segments' keys")
    if not transcript["segments"]:
        raise ValueError("Transcript segments cannot be empty")

    transcript_text = transcript["text"][:100000]
    segments_formatted = [f"[{s['start']:.1f}s] {s['text']}" for s in transcript["segments"]]
    segments_text = "\n".join(segments_formatted[:1000])

    prompt_config = await get_prompt("extract_podcast_takes")
    user_prompt = f"""Extract the {count} most interesting claims from this podcast transcript.

Full transcript text:
{transcript_text}

Timestamped segments:
{segments_text}

Return a JSON array of the top {count} claims, each with: claim, speaker, start, end, quality_score.
Only include claims with quality_score >= 70."""

    try:
        effective_model = model or prompt_config.get("model")
        response = await _call(
            system=prompt_config["system"],
            user=user_prompt,
            max_tokens=prompt_config["max_tokens"],
            retries=5,
            use_search=False,
            model=effective_model,
        )
        if isinstance(response, tuple):
            response = response[0]

        response = response.strip()
        if response.startswith("```"):
            response = re.sub(r'^```(?:json)?\s*', '', response)
            response = re.sub(r'\s*```$', '', response)

        takes = json.loads(response)
        if not isinstance(takes, list):
            raise ValueError("LLM response must be a JSON array")

        filtered = []
        for take in takes:
            if not isinstance(take, dict):
                continue
            # Support both new format (headline/context) and legacy (claim)
            headline = take.get("headline") or take.get("claim", "")
            context = take.get("context", "")
            if not all(f in take for f in ["speaker", "start", "end", "quality_score"]):
                continue
            if not isinstance(headline, str) or not headline.strip():
                continue
            if not isinstance(take["speaker"], str) or not take["speaker"].strip():
                continue
            if not isinstance(take["quality_score"], (int, float)):
                continue
            if not isinstance(take["start"], (int, float)):
                continue
            if not isinstance(take["end"], (int, float)):
                continue
            if take["quality_score"] < 70:
                continue
            if take["start"] < 0 or take["end"] < 0 or take["end"] <= take["start"]:
                continue
            filtered.append({
                "headline": headline.strip(),
                "context": context.strip() if isinstance(context, str) else "",
                "speaker": take["speaker"].strip(),
                "start": float(take["start"]),
                "end": float(take["end"]),
                "quality_score": int(take["quality_score"]),
            })

        return filtered

    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse LLM response as JSON: {e}")
    except Exception as e:
        raise ValueError(f"Failed to extract podcast takes: {str(e)}")
