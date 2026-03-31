"""
Observation pipeline — format thesis → steel man → stress test (on demand)
Supports Gemini (default) and Anthropic providers.
Gemini uses Google Search grounding for source citations.
"""
import json
import re
import asyncio
import base64
import httpx
from bs4 import BeautifulSoup
from config import settings

PROVIDER = settings.llm_provider  # "gemini" or "anthropic"

# ─── Provider setup ───────────────────────────────────────────────────────

if PROVIDER == "gemini":
    from google import genai
    gclient = genai.Client(api_key=settings.google_api_key)
    GEMINI_MODEL = settings.gemini_model
else:
    from anthropic import AsyncAnthropic, APIStatusError
    aclient = AsyncAnthropic(api_key=settings.anthropic_api_key)
    CLAUDE_MODEL = settings.claude_model


def _extract_json(raw: str) -> dict:
    """Robustly extract JSON from LLM response that may have markdown fences."""
    try:
        return json.loads(raw.strip())
    except json.JSONDecodeError:
        pass
    cleaned = re.sub(r'^```(?:json)?\s*', '', raw.strip())
    cleaned = re.sub(r'\s*```$', '', cleaned)
    try:
        return json.loads(cleaned.strip())
    except json.JSONDecodeError:
        pass
    start = raw.find('{')
    end = raw.rfind('}')
    if start != -1 and end != -1:
        return json.loads(raw[start:end+1])
    raise ValueError(f"Could not parse JSON from: {raw[:200]}")


def _extract_sources(resp) -> list[dict]:
    """Extract grounding source URLs from a Gemini response."""
    sources = []
    seen = set()
    try:
        metadata = resp.candidates[0].grounding_metadata
        if metadata and metadata.grounding_chunks:
            for chunk in metadata.grounding_chunks:
                if hasattr(chunk, 'web') and chunk.web:
                    url = chunk.web.uri
                    title = chunk.web.title or url
                    if url and url not in seen:
                        seen.add(url)
                        sources.append({"url": url, "title": title})
    except (AttributeError, IndexError):
        pass
    return sources[:6]  # cap at 6 sources


# ─── Unified _call ────────────────────────────────────────────────────────

async def _call(system: str, user: str, max_tokens: int = 2000, retries: int = 5, use_search: bool = False) -> str | tuple[str, list[dict]]:
    if PROVIDER == "gemini":
        return await _call_gemini(system, user, max_tokens, retries, use_search)
    result = await _call_anthropic(system, user, max_tokens, retries)
    if use_search:
        return result, []  # no search grounding for Anthropic
    return result


async def _call_gemini(system: str, user: str, max_tokens: int, retries: int, use_search: bool = False) -> str | tuple[str, list[dict]]:
    tools = []
    if use_search:
        tools = [genai.types.Tool(google_search=genai.types.GoogleSearch())]

    for attempt in range(retries):
        try:
            config = genai.types.GenerateContentConfig(
                system_instruction=system,
                max_output_tokens=max_tokens,
                thinking_config=genai.types.ThinkingConfig(thinking_budget=1024),
            )
            if tools:
                config.tools = tools

            resp = await asyncio.to_thread(
                gclient.models.generate_content,
                model=GEMINI_MODEL,
                contents=user,
                config=config,
            )
            text = resp.text.strip()
            if use_search:
                sources = _extract_sources(resp)
                return text, sources
            return text
        except Exception as e:
            err_str = str(e)
            if ("503" in err_str or "429" in err_str or "RESOURCE_EXHAUSTED" in err_str) and attempt < retries - 1:
                wait = min(2 ** (attempt + 1), 30)
                print(f"[pipeline/gemini] retrying in {wait}s (attempt {attempt+1}/{retries}): {err_str[:100]}")
                await asyncio.sleep(wait)
            else:
                raise


async def _call_anthropic(system: str, user: str, max_tokens: int, retries: int) -> str:
    for attempt in range(retries):
        try:
            msg = await aclient.messages.create(
                model=CLAUDE_MODEL,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            return msg.content[0].text.strip()
        except APIStatusError as e:
            if e.status_code in (429, 529) and attempt < retries - 1:
                wait = min(2 ** (attempt + 1), 30)
                print(f"[pipeline/anthropic] {e.status_code} — retrying in {wait}s (attempt {attempt+1}/{retries})")
                await asyncio.sleep(wait)
            else:
                raise


# ─── URL fetch ────────────────────────────────────────────────────────────

async def _fetch_url(url: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as http:
            resp = await http.get(url, headers={"User-Agent": "Mozilla/5.0"})
            soup = BeautifulSoup(resp.text, "html.parser")
            for tag in soup(["script", "style", "nav", "footer", "header"]):
                tag.decompose()
            return soup.get_text(separator=" ", strip=True)[:8000]
    except Exception as e:
        return f"[Could not fetch URL: {e}]"


# ─── Image extraction ────────────────────────────────────────────────────

async def extract_from_image(image_b64: str, media_type: str = "image/jpeg", context: str | None = None) -> str:
    if context:
        question = (
            f"The user adds this context or question: \"{context}\"\n\n"
            "Combining what you see in the image with this context, describe the core observation or insight in 1–3 plain sentences."
        )
    else:
        question = "What is the core observation or idea in this image?"

    system = (
        "You are a research editor. Look at this image and extract the core idea, "
        "claim, headline, or observation it contains. Describe it in 1–3 plain sentences "
        "as if briefing a colleague. No preamble. Output only the extracted observation."
    )

    if PROVIDER == "gemini":
        image_bytes = base64.b64decode(image_b64)
        image_part = genai.types.Part.from_bytes(data=image_bytes, mime_type=media_type)
        for attempt in range(3):
            try:
                resp = await asyncio.to_thread(
                    gclient.models.generate_content,
                    model=GEMINI_MODEL,
                    contents=[image_part, question],
                    config=genai.types.GenerateContentConfig(
                        system_instruction=system,
                        max_output_tokens=400,
                        thinking_config=genai.types.ThinkingConfig(thinking_budget=512),
                    ),
                )
                return resp.text.strip()
            except Exception as e:
                if attempt < 2:
                    print(f"[pipeline/gemini] image extract retry {attempt+1}: {str(e)[:100]}")
                    await asyncio.sleep(2 ** attempt)
                else:
                    raise
    else:
        for attempt in range(3):
            try:
                msg = await aclient.messages.create(
                    model=CLAUDE_MODEL,
                    max_tokens=400,
                    system=system,
                    messages=[{
                        "role": "user",
                        "content": [
                            {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_b64}},
                            {"type": "text", "text": question},
                        ],
                    }],
                )
                return msg.content[0].text.strip()
            except APIStatusError as e:
                if e.status_code in (429, 529) and attempt < 2:
                    print(f"[pipeline/anthropic] image extract {e.status_code} — retrying in {2**attempt}s")
                    await asyncio.sleep(2 ** attempt)
                else:
                    raise
    return ""


# ─── Pipeline steps ──────────────────────────────────────────────────────

async def format_thesis(raw_input: str, input_type: str, image_b64: str | None = None, image_media_type: str = "image/jpeg") -> str:
    """Turn raw input into a clear, researchable thesis (1–2 sentences)."""
    if input_type in ("photo", "screenshot") and image_b64:
        print(f"[format_thesis] extracting from image, context={raw_input[:60] if raw_input and raw_input != 'image' else None}")
        context = raw_input if raw_input and raw_input != "image" else None
        content = await extract_from_image(image_b64, image_media_type, context=context)
        print(f"[format_thesis] image extracted: {content[:100]}")
    elif input_type == "url":
        content = await _fetch_url(raw_input)
    else:
        content = raw_input

    return await _call(
        system=(
            "You are a research editor. The user has written an observation or argument. "
            "Clean it up into a clear thesis — preserve their specific claims, data points, and intent. "
            "Do NOT over-summarize or lose nuance. If the input is already clear, keep it nearly as-is. "
            "Output 1–3 sentences. No preamble. Output only the thesis."
        ),
        user=f"Raw observation: {content}",
        max_tokens=2000,
    )


async def generate_steel_man(thesis: str) -> tuple[str, list[dict]]:
    """Generate 4-5 punchy bullet points making the strongest case FOR the thesis.
    Returns (steel_man_text, sources) where sources is a list of {url, title} dicts."""
    result = await _call(
        system=(
            "You are a brilliant advocate and researcher. Given a thesis, produce 4-5 concise bullet points "
            "making the strongest possible case FOR it. Each bullet should be one crisp sentence — "
            "specific, compelling, and grounded in real evidence. Reference real data, studies, or examples. "
            "CRITICAL: Output ONLY the bullet points. No introduction, no summary, no headers, no preamble. "
            "Start immediately with the first '•' character."
        ),
        user=f"Steel man this thesis: {thesis}",
        max_tokens=2000,
        use_search=True,
    )
    if isinstance(result, tuple):
        text, sources = result
    else:
        text, sources = result, []
    # Strip any preamble before the first bullet
    first_bullet = text.find('•')
    if first_bullet > 0:
        text = text[first_bullet:]
    return text, sources


async def generate_metadata(thesis: str, steel_man: str) -> dict:
    """Generate evidence score (0-100), topic tags, and evidence type label."""
    prompt = f"""Thesis: {thesis}

Steel man:
{steel_man}

Classify this observation. Return a JSON object with exactly these keys:
{{
  "score": <integer 0-100 representing strength of evidence, where 100 = rock-solid empirical proof, 0 = pure speculation>,
  "tags": ["2-4 short topic tags, e.g. AI, Iran, Markets, Climate"],
  "evidence_type": "<one of: Empirical | Observational | Anecdotal | Speculative>"
}}

Return valid JSON only. No markdown fences. No preamble."""

    raw = await _call(
        system=(
            "You are a rigorous research classifier. You label observations by their evidence quality. "
            "You always return valid JSON when asked."
        ),
        user=prompt,
        max_tokens=2000,
    )

    return _extract_json(raw)


async def generate_stress_test(thesis: str, steel_man: str) -> tuple[dict, list[dict]]:
    """Stress test the thesis — pros, cons, verdict. Returns (result_dict, sources)."""
    prompt = f"""Thesis: {thesis}

Steel man argument:
{steel_man}

Now stress test this thesis objectively. Return a JSON object with exactly these keys:
{{
  "pros": ["3-4 SHORT points in favour — one sentence each, max 20 words"],
  "cons": ["3-4 SHORT weaknesses or objections — one sentence each, max 20 words"],
  "verdict": "One direct sentence: does this thesis stand up, and why or why not?"
}}

Be concise. Each bullet must be under 20 words. Return valid JSON only. No markdown fences. No preamble."""

    result = await _call(
        system=(
            "You are a rigorous intellectual critic and researcher. You evaluate arguments fairly, "
            "acknowledging both strengths and weaknesses. Ground your analysis in real evidence. "
            "You always return valid JSON when asked. Keep bullets very short."
        ),
        user=prompt,
        max_tokens=2000,
        use_search=True,
    )

    if isinstance(result, tuple):
        raw, sources = result
    else:
        raw, sources = result, []

    return _extract_json(raw), sources
