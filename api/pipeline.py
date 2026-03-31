"""
Observation pipeline — format thesis → steel man → stress test (on demand)
All Claude API calls are here.
"""
import json
import re
import asyncio
import httpx
from bs4 import BeautifulSoup
from anthropic import AsyncAnthropic, APIStatusError
from config import settings

client = AsyncAnthropic(api_key=settings.anthropic_api_key)


def _extract_json(raw: str) -> dict:
    """Robustly extract JSON from Claude response that may have markdown fences."""
    # Try direct parse first
    try:
        return json.loads(raw.strip())
    except json.JSONDecodeError:
        pass
    # Strip markdown fences
    cleaned = re.sub(r'^```(?:json)?\s*', '', raw.strip())
    cleaned = re.sub(r'\s*```$', '', cleaned)
    try:
        return json.loads(cleaned.strip())
    except json.JSONDecodeError:
        pass
    # Last resort: find first { to last }
    start = raw.find('{')
    end = raw.rfind('}')
    if start != -1 and end != -1:
        return json.loads(raw[start:end+1])
    raise ValueError(f"Could not parse JSON from: {raw[:200]}")
MODEL = settings.claude_model


async def _call(system: str, user: str, max_tokens: int = 2000, retries: int = 3) -> str:
    for attempt in range(retries):
        try:
            msg = await client.messages.create(
                model=MODEL,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            return msg.content[0].text.strip()
        except APIStatusError as e:
            if e.status_code in (429, 529) and attempt < retries - 1:
                wait = 2 ** attempt
                print(f"[pipeline] {e.status_code} — retrying in {wait}s (attempt {attempt+1}/{retries})")
                await asyncio.sleep(wait)
            else:
                raise


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


async def extract_from_image(image_b64: str, media_type: str = "image/jpeg", context: str | None = None) -> str:
    if context:
        question = (
            f"The user adds this context or question: \"{context}\"\n\n"
            "Combining what you see in the image with this context, describe the core observation or insight in 1–3 plain sentences."
        )
    else:
        question = "What is the core observation or idea in this image?"

    for attempt in range(3):
        try:
            msg = await client.messages.create(
                model=MODEL,
                max_tokens=400,
                system=(
                    "You are a research editor. Look at this image and extract the core idea, "
                    "claim, headline, or observation it contains. Describe it in 1–3 plain sentences "
                    "as if briefing a colleague. No preamble. Output only the extracted observation."
                ),
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
                print(f"[pipeline] image extract {e.status_code} — retrying in {2**attempt}s")
                await asyncio.sleep(2 ** attempt)
            else:
                raise


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
            "You are a research editor. Take the raw observation and reformulate it as a "
            "clear, specific, researchable thesis in 1–2 sentences. Be direct. No preamble. Output only the thesis."
        ),
        user=f"Raw observation: {content}",
        max_tokens=150,
    )


async def generate_steel_man(thesis: str) -> str:
    """Generate 4-5 punchy bullet points making the strongest case FOR the thesis."""
    return await _call(
        system=(
            "You are a brilliant advocate. Given a thesis, produce 4-5 concise bullet points "
            "making the strongest possible case FOR it. Each bullet should be one crisp sentence — "
            "specific, compelling, and grounded. No preamble. No headers. "
            "Output each bullet on its own line starting with '•'."
        ),
        user=f"Steel man this thesis: {thesis}",
        max_tokens=400,
    )


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
        max_tokens=200,
    )

    return _extract_json(raw)


async def generate_stress_test(thesis: str, steel_man: str) -> dict:
    """Stress test the thesis — pros, cons, and a verdict on whether it holds up."""
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

    raw = await _call(
        system=(
            "You are a rigorous intellectual critic. You evaluate arguments fairly, "
            "acknowledging both strengths and weaknesses. You always return valid JSON when asked. Keep bullets very short."
        ),
        user=prompt,
        max_tokens=1000,
    )

    return _extract_json(raw)
