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
    ACTIVE_MODEL = GEMINI_MODEL
else:
    from anthropic import AsyncAnthropic, APIStatusError
    aclient = AsyncAnthropic(api_key=settings.anthropic_api_key)
    CLAUDE_MODEL = settings.claude_model
    ACTIVE_MODEL = CLAUDE_MODEL


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
                thinking_config=genai.types.ThinkingConfig(thinking_budget=0),
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


# ─── Tavily search ───────────────────────────────────────────────────────

async def _search_tavily(query: str, max_results: int = 5) -> tuple[str, list[dict]]:
    """Search Tavily and return (context_text, sources_list). Times out after 8s."""
    if not settings.tavily_api_key:
        return "", []
    try:
        from tavily import TavilyClient
        client = TavilyClient(api_key=settings.tavily_api_key)
        resp = await asyncio.wait_for(
            asyncio.to_thread(
                client.search,
                query=query,
                max_results=max_results,
                include_raw_content=False,
            ),
            timeout=8.0,
        )
        sources = []
        context_parts = []
        for r in resp.get("results", []):
            url = r.get("url", "")
            title = r.get("title", url)
            content = r.get("content", "")
            sources.append({"url": url, "title": title})
            if content:
                context_parts.append(f"- {title}: {content}")
        context = "\n".join(context_parts)
        return context, sources
    except asyncio.TimeoutError:
        print("[tavily] search timed out after 8s — proceeding without")
        return "", []
    except Exception as e:
        print(f"[tavily] search failed: {e}")
        return "", []


# ─── URL fetch ────────────────────────────────────────────────────────────

PAYWALL_SIGNALS = [
    "subscribe", "subscription", "sign in to read", "sign in to continue",
    "create an account", "already a subscriber", "unlimited access",
    "gift subscription", "log in", "you've read your free",
]

async def _fetch_url(url: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as http:
            resp = await http.get(url, headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Accept-Encoding": "gzip, deflate, br",
                "Cache-Control": "no-cache",
            })
            soup = BeautifulSoup(resp.text, "html.parser")
            for tag in soup(["script", "style", "nav", "footer", "header"]):
                tag.decompose()
            text = soup.get_text(separator=" ", strip=True)
            # Detect paywall
            lower = text.lower()
            if len(text) < 500 or sum(1 for s in PAYWALL_SIGNALS if s in lower) >= 2:
                return "[PAYWALL] This article is behind a paywall. Please paste the article text directly instead."
            return text[:8000]
    except Exception as e:
        return f"[Could not fetch URL: {e}]"


# ─── Image extraction ────────────────────────────────────────────────────

async def extract_from_image(image_b64: str, media_type: str = "image/jpeg", context: str | None = None) -> str:
    if context:
        question = (
            f"The user's claim is: \"{context}\"\n\n"
            "The image is supporting context. Output the user's claim as a clear, arguable thesis statement — "
            "exactly as they intend it. Do NOT fact-check or correct them. Do NOT describe the image. "
            "Just restate their claim cleanly as a thesis in 1–2 sentences."
        )
    else:
        question = (
            "Look at this image and identify the core claim, argument, or debatable assertion it represents. "
            "State it as a thesis — an arguable position someone could defend. 1–2 sentences. No preamble."
        )

    system = (
        "You are a debate coach. Your job is to extract or restate a THESIS — a debatable claim that can be "
        "argued for and against. Never describe what you see. Never fact-check. Never correct the user. "
        "Output only the thesis statement."
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
                        thinking_config=genai.types.ThinkingConfig(thinking_budget=0),
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
        if content.startswith("[PAYWALL]"):
            raise ValueError(content)
    else:
        content = raw_input

    return await _call(
        system=(
            "You are a sharp debate editor. Convert the user's input into a punchy, confident THESIS STATEMENT. "
            "Rules: (1) Declarative claim only — no questions, no descriptions, no hedging. "
            "(2) Preserve the user's exact intent and any specific data points. "
            "(3) Do NOT fact-check or correct their claim — if they say X is Y, the thesis is 'X is Y'. "
            "(4) Make it short, direct, and a little provocative — the kind of line that makes someone want to argue. "
            "(5) Max 1 sentence. No preamble. Output only the thesis."
        ),
        user=f"User input: {content}",
        max_tokens=2000,
    )


async def format_challenge_thesis(raw_input: str, parent_thesis: str) -> str:
    """Turn a challenge's raw input into a thesis that directly opposes the parent."""
    return await _call(
        system=(
            "You are a sharp debate editor. The user is CHALLENGING an existing claim. "
            "Convert their counter-argument into a punchy thesis that OPPOSES the original claim. "
            "Rules: (1) The thesis must DISAGREE with the original claim. "
            "(2) Preserve the user's exact intent — if they say 'he's a crook', the thesis should say he's a crook. "
            "(3) Reference the specific subject from the original claim (names, topics) even if the user didn't. "
            "(4) Max 1 sentence. No preamble. Output only the thesis."
        ),
        user=f"ORIGINAL CLAIM: {parent_thesis}\n\nUSER'S COUNTER-ARGUMENT: {raw_input}",
        max_tokens=200,
    )


async def generate_steel_man(thesis: str, challenge_context: str | None = None) -> tuple[str, list[dict]]:
    """Generate 4-5 punchy bullet points making the strongest case FOR the thesis.
    Returns (steel_man_text, sources) where sources is a list of {url, title} dicts."""
    search_context, sources = "", []
    if PROVIDER == "anthropic" and settings.tavily_api_key:
        search_context, sources = await _search_tavily(thesis)

    if challenge_context:
        user_prompt = f"{challenge_context}\n\nCHALLENGE THESIS TO STEEL MAN: {thesis}"
    else:
        user_prompt = f"Steel man this thesis: {thesis}"
    if search_context:
        user_prompt += f"\n\nCurrent real-world context and evidence to draw from:\n{search_context}"

    if challenge_context:
        system = (
            "You are a world-class intellectual advocate. "
            "You are given an ORIGINAL CLAIM and its steel man, plus a CHALLENGE THESIS that opposes it. "
            "Your job: build the strongest case FOR the challenge thesis, directly addressing why the original claim is wrong. "
            "Produce exactly 4-5 bullet points. Each bullet must: (1) directly counter the original claim, "
            "(2) cite a real statistic, study, event, or named example, (3) be 1-2 sentences max. "
            "Stay focused on the debate between original and challenge — do not go off topic. "
            "CRITICAL: Output ONLY the bullet points starting with '•'. Zero preamble. Zero summary. "
            "First character of your response must be '•'."
        )
    else:
        system = (
            "You are a world-class intellectual advocate — part lawyer, part researcher, part analyst. "
            "Your job is to construct the most powerful, evidence-based case FOR a thesis. "
            "Produce exactly 4-5 bullet points. Each bullet must: (1) make one specific, substantive claim, "
            "(2) cite a real statistic, study, event, or named example, (3) be 1-2 sentences max. "
            "Prioritize depth and specificity over breadth. Avoid vague generalities. "
            "Use current real-world data from your search results where available. "
            "CRITICAL: Output ONLY the bullet points starting with '•'. Zero preamble. Zero summary. "
            "First character of your response must be '•'."
        )

    result = await _call(
        system=system,
        user=user_prompt,
        max_tokens=2000,
        use_search=(PROVIDER == "gemini"),
    )
    if isinstance(result, tuple):
        text, gemini_sources = result
        sources = gemini_sources if gemini_sources else sources
    else:
        text = result
    first_bullet = text.find('•')
    if first_bullet > 0:
        text = text[first_bullet:]
    return text, sources


async def generate_metadata(thesis: str, steel_man: str, image_b64: str | None = None, image_media_type: str = "image/jpeg") -> dict:
    """Generate evidence score (0-100), topic tags, and evidence type label."""
    system = (
        "You are a rigorous fact-checker and research classifier. "
        "You score claims based on actual real-world evidence — not on how convincing the argument sounds. "
        "If an image is provided, use it as direct visual evidence to verify the claim. "
        "A well-argued case for a false or visually contradicted claim still scores near zero. "
        "You always return valid JSON when asked."
    )

    prompt = f"""Thesis: {thesis}

Score this thesis based on how well it is supported by REAL-WORLD evidence and established fact.
If an image is provided, it is the PRIMARY evidence — score based on what you actually see.

Rules for scoring:
- 85-100: Strong empirical consensus, peer-reviewed studies, or visually confirmed fact
- 60-84: Credible evidence but some debate or mixed data
- 35-59: Contested, limited evidence, reasonable but unproven
- 10-34: Weak evidence, speculative, or contradicts available data
- 0-9: Factually wrong, visually contradicted by the image, or contradicts established reality

Return a JSON object with exactly these keys:
{{
  "score": <integer 0-100>,
  "tags": ["2-4 short topic tags"],
  "evidence_type": "<one of: Empirical | Observational | Anecdotal | Speculative>"
}}

Return valid JSON only. No markdown fences. No preamble."""

    if PROVIDER == "gemini" and image_b64:
        image_bytes = base64.b64decode(image_b64)
        image_part = genai.types.Part.from_bytes(data=image_bytes, mime_type=image_media_type)
        for attempt in range(3):
            try:
                resp = await asyncio.to_thread(
                    gclient.models.generate_content,
                    model=GEMINI_MODEL,
                    contents=[image_part, prompt],
                    config=genai.types.GenerateContentConfig(
                        system_instruction=system,
                        max_output_tokens=500,
                        thinking_config=genai.types.ThinkingConfig(thinking_budget=0),
                    ),
                )
                return _extract_json(resp.text.strip())
            except Exception as e:
                if attempt < 2:
                    await asyncio.sleep(2 ** attempt)
                else:
                    raise

    raw = await _call(system=system, user=prompt, max_tokens=500)
    return _extract_json(raw)


async def generate_stress_test(thesis: str, steel_man: str) -> tuple[dict, list[dict]]:
    """Stress test the thesis — pros, cons, verdict. Returns (result_dict, sources)."""
    search_context, sources = "", []
    if PROVIDER == "anthropic" and settings.tavily_api_key:
        search_context, sources = await _search_tavily(f"counterarguments against: {thesis}")

    prompt = f"""Thesis: {thesis}

Steel man argument:
{steel_man}"""

    if search_context:
        prompt += f"\n\nCurrent real-world context:\n{search_context}"

    prompt += """

Now stress test this thesis objectively. Return a JSON object with exactly these keys:
{
  "pros": ["3-4 SHORT points in favour — one sentence each, max 20 words"],
  "cons": ["3-4 SHORT weaknesses or objections — one sentence each, max 20 words"],
  "verdict": "One direct sentence: does this thesis stand up, and why or why not?"
}

Be concise. Each bullet must be under 20 words. Return valid JSON only. No markdown fences. No preamble."""

    result = await _call(
        system=(
            "You are a rigorous intellectual critic and fact-checker. "
            "Your job: stress test this thesis with hard evidence — no platitudes. "
            "Pros must cite concrete data, named studies, or real-world examples. "
            "Cons must name real weaknesses: confounds, missing evidence, contrary data, logical gaps. "
            "Use current search results where available. "
            "Return ONLY valid JSON. No markdown. No preamble. Each bullet max 20 words."
        ),
        user=prompt,
        max_tokens=2000,
        use_search=(PROVIDER == "gemini"),
    )

    if isinstance(result, tuple):
        raw, gemini_sources = result
        sources = gemini_sources if gemini_sources else sources
    else:
        raw = result

    return _extract_json(raw), sources


async def call_bullshit(thesis: str, steel_man: str) -> dict:
    """Fast credibility check. Returns {bs_score: 0-100, bs_verdict: str}. 100 = total BS."""
    result = await _call(
        system=(
            "You are a brutally honest fact-checker. "
            "You evaluate claims with no mercy — if it's wrong, say so. "
            "Return ONLY valid JSON. No markdown. No preamble."
        ),
        user=(
            f"Thesis: {thesis}\n\n"
            f"Steel man arguments:\n{steel_man}\n\n"
            f"Give this a BS Score from 0-100 where 100 = completely false or misleading, 0 = solid truth.\n"
            f"Also write ONE punchy sentence (max 15 words) explaining the core problem with this claim.\n"
            f"Use real evidence from search where available.\n\n"
            f"Return JSON: {{\"bs_score\": <integer 0-100>, \"bs_verdict\": \"<one punchy sentence>\"}}"
        ),
        max_tokens=300,
        use_search=(PROVIDER == "gemini"),
    )
    if isinstance(result, tuple):
        raw = result[0]
    else:
        raw = result
    return _extract_json(raw)


async def negate_thesis(thesis: str) -> str:
    """Return the logical opposite of a thesis as a punchy statement."""
    result = await _call(
        system="You are a debate coach. Flip the thesis into its strongest opposing claim. One sentence, punchy and direct. No preamble.",
        user=f"Original thesis: {thesis}\n\nWrite the opposing thesis:",
        max_tokens=100,
    )
    return result.strip() if isinstance(result, str) else result[0].strip()
