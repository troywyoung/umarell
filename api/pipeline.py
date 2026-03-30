"""
Observation pipeline — format → research → structure → stress test
All Claude API calls are here.
"""
import json
import asyncio
import httpx
from bs4 import BeautifulSoup
from anthropic import AsyncAnthropic
from config import settings

client = AsyncAnthropic(api_key=settings.anthropic_api_key)
MODEL = settings.claude_model


async def _call(system: str, user: str, max_tokens: int = 2000) -> str:
    msg = await client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return msg.content[0].text.strip()


async def _fetch_url(url: str) -> str:
    """Fetch and extract readable text from a URL."""
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as http:
            resp = await http.get(url, headers={"User-Agent": "Mozilla/5.0"})
            soup = BeautifulSoup(resp.text, "html.parser")
            for tag in soup(["script", "style", "nav", "footer", "header"]):
                tag.decompose()
            return soup.get_text(separator=" ", strip=True)[:8000]
    except Exception as e:
        return f"[Could not fetch URL: {e}]"


async def extract_from_image(image_b64: str, media_type: str = "image/jpeg") -> str:
    """Use Claude vision to extract the core observation from a screenshot or photo."""
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
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": image_b64,
                    },
                },
                {"type": "text", "text": "What is the core observation or idea in this image?"},
            ],
        }],
    )
    return msg.content[0].text.strip()


async def format_thesis(raw_input: str, input_type: str, image_b64: str | None = None, image_media_type: str = "image/jpeg") -> str:
    """Turn raw input into a clear, researchable thesis (1–2 sentences)."""
    if input_type in ("photo", "screenshot") and image_b64:
        print(f"[format_thesis] extracting from image, media_type={image_media_type}, b64_len={len(image_b64)}")
        content = await extract_from_image(image_b64, image_media_type)
        print(f"[format_thesis] image extracted: {content[:100]}")
    elif input_type == "url":
        content = await _fetch_url(raw_input)
    else:
        content = raw_input

    result = await _call(
        system=(
            "You are a research editor. Your job is to take a raw observation and "
            "reformulate it as a clear, specific, researchable thesis or question in 1–2 sentences. "
            "Be direct. No preamble. Output only the thesis."
        ),
        user=f"Raw observation: {content}",
        max_tokens=150,
    )
    return result


async def research_observation(thesis: str) -> dict:
    """
    Run the full research pipeline and return structured output.
    Returns a dict matching the 6-layer structure + stress test.
    """
    prompt = f"""Thesis to research: {thesis}

Research this thesis thoroughly and return a JSON object with exactly these keys:

{{
  "confidence": "well_supported" | "contested" | "speculative",
  "summary": "2–3 sentence synthesis of what this thesis is about and why it matters",
  "supporting_ideas": [
    {{"text": "...", "source_title": "...", "source_url": null}},
    ...  // 3–5 items
  ],
  "counter_ideas": [
    {{"text": "...", "source_title": "...", "source_url": null}},
    ...  // 3–5 items
  ],
  "context": "Historical, cultural, industry, or political framing paragraph",
  "more_questions": [
    {{"text": "Follow-on question or thread"}},
    ...  // 3–5 items
  ],
  "stress_test": {{
    "assumptions": ["Core assumption 1", "Core assumption 2", "..."],  // 2–4 items
    "strongest_objection": "The single strongest argument that would make this thesis false",
    "evidence_flags": ["Where evidence is thin or potentially biased", "..."],  // 1–3 items
    "confidence_signal": "well_supported" | "contested" | "speculative"
  }}
}}

Rules:
- Return valid JSON only. No markdown fences, no preamble.
- supporting_ideas and counter_ideas: each needs a text field. source_title and source_url are optional.
- stress_test tone: smart, slightly skeptical colleague — rigorous but not dismissive.
- confidence_signal in stress_test should match the top-level confidence field.
"""

    raw = await _call(
        system=(
            "You are a research analyst and rigorous thinker. "
            "You produce structured, well-sourced, balanced intelligence briefs. "
            "You always return valid JSON when asked."
        ),
        user=prompt,
        max_tokens=3000,
    )

    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    return json.loads(raw)


async def generate_briefing(thesis: str, research: dict) -> str:
    """
    Generate a 300–500 word editorial-quality briefing.
    This is the product's signature output — good enough to forward.
    """
    supporting = "\n".join(f"- {p['text']}" for p in research.get("supporting_ideas", []))
    counter = "\n".join(f"- {p['text']}" for p in research.get("counter_ideas", []))
    context = research.get("context", "")
    stress = research.get("stress_test", {}).get("strongest_objection", "")

    prompt = f"""Write a Briefing on the following thesis.

Thesis: {thesis}

Supporting arguments:
{supporting}

Counter arguments:
{counter}

Context:
{context}

Strongest objection:
{stress}

The Briefing must:
- Be 300–500 words of editorial prose. No bullet points, no headers.
- Have the voice of a smart, well-informed colleague writing an intelligent memo.
- Cover: what the thesis claims and why it matters, the key supporting and counter arguments, relevant context, and a forward-looking observation.
- Be good enough to forward directly. If it reads like generic AI, it fails.
- Start with a strong, direct opening sentence. No "In recent years" or similar clichés.

Output the briefing text only. No title. No preamble."""

    return await _call(
        system=(
            "You are a senior editor writing intelligence briefings for senior executives, "
            "journalists, and analysts. Your writing is clear, direct, and smart. "
            "Every sentence earns its place."
        ),
        user=prompt,
        max_tokens=800,
    )
