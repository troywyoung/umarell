"""
news_service.py — fetch opinion pieces from NYT and WSJ RSS feeds and extract takes.
"""
import asyncio
import json
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

import httpx

SOURCES = {
    "nyt-opinion": {
        "label":    "NYT Opinion",
        "feed_url": "https://rss.nytimes.com/services/xml/rss/nyt/Opinion.xml",
        "tag_prefix": "nyt-opinion",
    },
    "wsj-opinion": {
        "label":    "WSJ Opinion",
        "feed_url": "https://feeds.content.dowjones.io/public/rss/RSSOpinion",
        "tag_prefix": "wsj-opinion",
    },
    "bloomberg-opinion": {
        "label":    "Bloomberg Opinion",
        "feed_url": "https://feeds.bloomberg.com/opinion/news.rss",
        "tag_prefix": "bloomberg-opinion",
    },
}

_DC  = "http://purl.org/dc/elements/1.1/"
_CONTENT = "http://purl.org/rss/1.0/modules/content/"


def _parse_rss(xml_text: str) -> list[dict]:
    """Parse RSS XML into a list of story dicts."""
    root = ET.fromstring(xml_text)
    channel = root.find("channel")
    if channel is None:
        return []
    items = []
    for item in channel.findall("item"):
        title       = (item.findtext("title") or "").strip()
        url         = (item.findtext("link") or "").strip()
        description = (item.findtext("description") or "").strip()
        author      = (item.findtext(f"{{{_DC}}}creator") or "").strip()
        pub_date    = (item.findtext("pubDate") or "").strip()
        if title and url:
            items.append({
                "title":       title,
                "url":         url,
                "description": description,
                "author":      author,
                "pub_date":    pub_date,
            })
    return items


async def fetch_opinion_stories(source_key: str) -> list[dict]:
    """Fetch today's opinion pieces from the given source."""
    source = SOURCES.get(source_key)
    if not source:
        raise ValueError(f"Unknown source: {source_key}")

    headers = {"User-Agent": "Mozilla/5.0 (compatible; UmarellBot/1.0)"}
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(source["feed_url"], headers=headers)
        resp.raise_for_status()

    return _parse_rss(resp.text)


async def extract_opinion_takes(stories: list[dict], source_key: str, count: int = 5) -> list[dict]:
    """Distill each opinion piece into a sharp take, preserving author attribution."""
    from pipeline import _call

    source_label = SOURCES[source_key]["label"]

    stories_text = "\n".join(
        f'- Author: {s["author"] or "Editorial Board"}\n'
        f'  Headline: {s["title"]}\n'
        f'  Summary: {s["description"][:200] if s["description"] else "(no summary)"}\n'
        f'  URL: {s["url"]}'
        for s in stories[:30]
    )

    system = (
        "You are distilling opinion journalism into sharp, arguable takes. "
        "Each take captures the author's central argument as a single punchy thesis. "
        "You always return valid JSON."
    )

    user_prompt = f"""Here are today's {source_label} opinion pieces:

{stories_text}

Pick the {count} most take-worthy pieces. For each, distill the author's central argument into a sharp, \
specific, one-sentence thesis — the kind of claim that would make someone stop and react. \
Do not just restate the headline. Find the actual argument underneath it.

Each item must have:
- headline: the distilled thesis as a sharp, arguable one-liner (your words, capturing their argument)
- context: 1 sentence of supporting reasoning or stakes
- author: the author name exactly as given (use "Editorial Board" if blank)
- source_title: the original article headline
- source_url: the article URL
- quality_score: 0–100 (how specific, falsifiable, and argumentative is this take?)

Only include pieces where quality_score >= 60.

Return JSON only: {{"takes": [...]}}"""

    response = await _call(
        system=system,
        user=user_prompt,
        max_tokens=2000,
        retries=3,
        use_search=False,
    )
    if isinstance(response, tuple):
        response = response[0]

    response = response.strip()
    if response.startswith("```"):
        response = re.sub(r"^```(?:json)?\s*", "", response)
        response = re.sub(r"\s*```$", "", response)

    data = json.loads(response)
    takes_raw = data.get("takes", data) if isinstance(data, dict) else data

    filtered = []
    for take in takes_raw:
        if not isinstance(take, dict):
            continue
        headline     = (take.get("headline") or "").strip()
        context      = (take.get("context") or "").strip()
        author       = (take.get("author") or "Editorial Board").strip()
        source_title = (take.get("source_title") or "").strip()
        source_url   = (take.get("source_url") or "").strip()
        qs           = take.get("quality_score", 0)
        if not headline or not source_url:
            continue
        if not isinstance(qs, (int, float)) or qs < 60:
            continue
        filtered.append({
            "headline":     headline,
            "context":      context,
            "author":       author,
            "source_title": source_title,
            "source_url":   source_url,
            "quality_score": int(qs),
        })

    return filtered[:count]


def make_bundle_tag(source_key: str) -> str:
    now = datetime.now(timezone.utc)
    prefix = SOURCES[source_key]["tag_prefix"]
    return f"{prefix}-{now.strftime('%Y-%m-%d')}"


def make_bundle_title(source_key: str) -> str:
    source_label = SOURCES[source_key]["label"]
    now = datetime.now(timezone.utc)
    day = now.strftime("%a %b ") + str(now.day)   # "Mon Apr 7"
    return f"{source_label} Takes | {day}"
