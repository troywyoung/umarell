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
from prompts import get_prompt

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


def _clean_json_str(s: str) -> str:
    """Remove invalid control characters that break JSON parsing."""
    # Strip markdown fences
    s = re.sub(r'^```(?:json)?\s*', '', s.strip())
    s = re.sub(r'\s*```$', '', s)
    # Remove ASCII control chars except tab/newline/CR
    s = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', s)
    return s.strip()


def _extract_json(raw: str) -> dict:
    """Robustly extract JSON from LLM response that may have markdown fences or control chars."""
    for candidate in [raw.strip(), _clean_json_str(raw)]:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass
    # Last resort: find outermost braces
    cleaned = _clean_json_str(raw)
    start = cleaned.find('{')
    end = cleaned.rfind('}')
    if start != -1 and end != -1:
        return json.loads(cleaned[start:end+1])
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

async def _call(system: str, user: str, max_tokens: int = 2000, retries: int = 5, use_search: bool = False, return_metadata: bool = False, model: str | None = None):
    if PROVIDER == "gemini":
        return await _call_gemini(system, user, max_tokens, retries, use_search, return_metadata, model)
    result = await _call_anthropic(system, user, max_tokens, retries, return_metadata, model)
    if return_metadata and use_search:
        # Add empty sources for Anthropic when search is requested but not supported
        if isinstance(result, dict):
            result["sources"] = []
        return result
    if use_search:
        return result, []  # no search grounding for Anthropic
    return result


async def _call_gemini(system: str, user: str, max_tokens: int, retries: int, use_search: bool = False, return_metadata: bool = False, model: str | None = None):
    tools = []
    if use_search:
        tools = [genai.types.Tool(google_search=genai.types.GoogleSearch())]

    model_to_use = model or GEMINI_MODEL

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
                model=model_to_use,
                contents=user,
                config=config,
            )
            text = resp.text.strip()

            if return_metadata:
                # Gemini usage metadata
                input_tokens = getattr(resp.usage_metadata, 'prompt_token_count', 0) if hasattr(resp, 'usage_metadata') else 0
                output_tokens = getattr(resp.usage_metadata, 'candidates_token_count', 0) if hasattr(resp, 'usage_metadata') else 0
                metadata = {
                    "text": text,
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "model": model_to_use
                }
                if use_search:
                    sources = _extract_sources(resp)
                    metadata["sources"] = sources
                    return metadata
                return metadata

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


async def _call_anthropic(system: str, user: str, max_tokens: int, retries: int, return_metadata: bool = False, model: str | None = None):
    model_to_use = model or CLAUDE_MODEL
    for attempt in range(retries):
        try:
            msg = await aclient.messages.create(
                model=model_to_use,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            text = msg.content[0].text.strip()
            if return_metadata:
                return {
                    "text": text,
                    "input_tokens": msg.usage.input_tokens,
                    "output_tokens": msg.usage.output_tokens,
                    "model": msg.model
                }
            return text
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
    "gift subscription", "you've read your free",
]

COOKIE_WALL_SIGNALS = [
    "we use cookies", "accept cookies", "cookie consent", "cookie policy",
    "manage cookies", "reject all", "accept all", "privacy settings",
    "your privacy choices", "gdpr",
]

async def _fetch_reddit(url: str) -> str:
    """Fetch Reddit posts via Tavily extract (bypasses Reddit's datacenter IP blocks)."""
    try:
        if not settings.tavily_api_key:
            raise ValueError("No Tavily API key — cannot fetch Reddit URLs from server")

        # Strip UTM/share params but keep the core URL
        base = url.split("?")[0].split("#")[0].rstrip("/")

        # Resolve /s/ share links
        if "/s/" in base or "/comments/" not in base:
            headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
            async with httpx.AsyncClient(timeout=20, follow_redirects=True) as http:
                r = await http.get(url, headers=headers)
                base = str(r.url).split("?")[0].split("#")[0].rstrip("/")
            print(f"[reddit] resolved share link → {base}")
            if "/comments/" not in base:
                raise ValueError(f"Could not resolve to a Reddit post. Got: {base}")

        print(f"[reddit] extracting via Tavily: {base}")
        from tavily import TavilyClient
        client = TavilyClient(api_key=settings.tavily_api_key)
        result = await asyncio.wait_for(
            asyncio.to_thread(client.extract, urls=[base]),
            timeout=15.0,
        )
        results = result.get("results", [])
        if not results or not results[0].get("raw_content"):
            raise ValueError("Tavily returned no content for this Reddit URL")

        content = results[0]["raw_content"][:6000]
        print(f"[reddit] got {len(content)} chars via Tavily")
        return content

    except Exception as e:
        return f"[Could not fetch Reddit URL: {e}]"


NAV_JUNK_SIGNALS = [
    "skip to navigation", "skip to content", "skip to main",
    "print subscriptions", "search jobs", "sign in to comment",
    "advertisement", "most viewed", "more from this section",
]

def _is_junk_content(text: str) -> bool:
    """Returns True if the content looks like navigation/cookie wall rather than article body."""
    lower = text.lower()
    # Cookie wall check
    cookie_hits = sum(1 for s in COOKIE_WALL_SIGNALS if s in lower)
    if cookie_hits >= 3 and len(text) < 3000:
        return True
    # Navigation junk check — lots of bracketed links and nav signals
    nav_hits = sum(1 for s in NAV_JUNK_SIGNALS if s in lower)
    bracket_density = text.count("[") / max(len(text), 1)
    if nav_hits >= 2 or bracket_density > 0.02:
        return True
    return False


async def _fetch_via_tavily(url: str) -> str:
    """Fetch URL content via Tavily extract with search fallback."""
    if not settings.tavily_api_key:
        return ""
    try:
        from tavily import TavilyClient
        client = TavilyClient(api_key=settings.tavily_api_key)

        # Try extract first
        try:
            result = await asyncio.wait_for(
                asyncio.to_thread(client.extract, urls=[url]),
                timeout=20.0,
            )
            results = result.get("results", [])
            if results and results[0].get("raw_content"):
                content = results[0]["raw_content"]
                if len(content) >= 300 and not _is_junk_content(content):
                    print(f"[tavily extract] got {len(content)} chars for {url}")
                    return content[:8000]
                print(f"[tavily extract] result looks like cookie wall or too short for {url}")
        except asyncio.TimeoutError:
            print(f"[tavily extract] timed out for {url}")
        except Exception as e:
            print(f"[tavily extract] failed for {url}: {e}")

        # Search fallback — often finds the article even when extract fails
        print(f"[tavily] trying search fallback for {url}")
        search_result = await asyncio.wait_for(
            asyncio.to_thread(client.search, url, max_results=5, include_raw_content=True),
            timeout=12.0,
        )
        for r in search_result.get("results", []):
            content = r.get("raw_content") or r.get("content", "")
            if content and len(content) >= 300 and not _is_junk_content(content):
                print(f"[tavily search fallback] got {len(content)} chars for {url}")
                return content[:8000]

    except Exception as e:
        print(f"[tavily] all attempts failed for {url}: {e}")
    return ""


async def _fetch_url(url: str) -> str:
    # Route Reddit URLs through dedicated handler
    if "reddit.com" in url:
        return await _fetch_reddit(url)

    # Try Tavily first — it reliably handles Substack, Medium, paywalled sites, etc.
    # Direct HTTP from a datacenter gets blocked or returns cookie/consent pages
    if settings.tavily_api_key:
        tavily_content = await _fetch_via_tavily(url)
        if tavily_content:
            return tavily_content
        print(f"[fetch] Tavily failed for {url}, falling back to direct HTTP")

    # Direct HTTP fallback
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as http:
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
            lower = text.lower()
            cookie_hits = sum(1 for s in COOKIE_WALL_SIGNALS if s in lower)
            paywall_hits = sum(1 for s in PAYWALL_SIGNALS if s in lower)
            if cookie_hits >= 3:
                return "[COOKIE_WALL] Site served a cookie consent page. Paste the article text directly instead."
            if len(text) >= 500 and paywall_hits < 2:
                return text[:8000]
            return "[PAYWALL] This article is behind a paywall. Please paste the article text directly instead."
    except Exception as e:
        pass

    return "[Could not fetch URL: site may be blocking server requests. Paste the article text directly instead.]"


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
        if content.startswith(("[PAYWALL]", "[COOKIE_WALL]", "[Could not fetch")):
            raise ValueError(content)
    else:
        content = raw_input

    prompt_config = await get_prompt("format_thesis")
    return await _call(
        system=prompt_config["system"],
        user=f"User input: {content}",
        max_tokens=prompt_config["max_tokens"],
    )


async def format_challenge_thesis(raw_input: str, parent_thesis: str) -> str:
    """Turn a challenge's raw input into a thesis that directly opposes the parent."""
    prompt_config = await get_prompt("format_challenge_thesis")
    return await _call(
        system=prompt_config["system"],
        user=f"ORIGINAL CLAIM: {parent_thesis}\n\nUSER'S COUNTER-ARGUMENT: {raw_input}",
        max_tokens=prompt_config["max_tokens"],
    )


async def generate_steel_man(thesis: str, challenge_context: str | None = None) -> tuple[dict, list[dict]]:
    """Generate a steelman with bottom_line + bullets.
    Returns (steelman_dict, sources) where steelman_dict = {bottom_line: str, bullets: [str]}."""
    search_context, sources = "", []
    if PROVIDER == "anthropic" and settings.tavily_api_key:
        search_context, sources = await _search_tavily(thesis)

    if challenge_context:
        user_prompt = f"{challenge_context}\n\nCHALLENGE THESIS TO STEEL MAN: {thesis}"
    else:
        user_prompt = f"Steel man this thesis: {thesis}"
    if search_context:
        user_prompt += f"\n\nCurrent real-world context and evidence to draw from:\n{search_context}"

    user_prompt += """

Return a JSON object with exactly these keys:
{
  "bottom_line": "1 punchy sentence — the single strongest argument for this thesis.",
  "bullets": ["3-4 arguments — each ONE sentence max, sharp and direct. No throat-clearing. Lead with the point."],
  "hard_facts": [{"fact": "specific data point, one clean sentence, no source in the sentence", "source": "Source Name, Year"}]
}

Return valid JSON only. No markdown fences. No preamble."""

    if challenge_context:
        system = (
            "You are a world-class intellectual advocate. "
            "You are given an ORIGINAL CLAIM and its steel man, plus a CHALLENGE THESIS that opposes it. "
            "Your job: build the strongest case FOR the challenge thesis, directly addressing why the original claim is wrong. "
            "The bottom_line is the single most devastating argument against the original claim. "
            "HARD FACTS must be objects with 'fact' (plain sentence, no inline source), 'source' (Name, Year), and 'url' (direct link). "
            "Each bullet must directly counter the original claim with real evidence. "
            "Stay focused on the debate. Use current search results where available. "
            "Return ONLY valid JSON. No markdown. No preamble."
        )
    else:
        system = (
            "You are a world-class intellectual advocate — part lawyer, part researcher, part analyst. "
            "Your job is to construct the most powerful, evidence-based case FOR a thesis. "
            "The bottom_line is the single strongest argument — the verdict on why this holds up. "
            "HARD FACTS are the foundation: prioritize data from government agencies (BLS, Census Bureau, CDC, Federal Reserve, CBO, OECD, World Bank, IMF, WHO, NIH, etc.), "
            "peer-reviewed journals, and official statistics. Each hard_fact is an object: { fact, source, url }. The 'fact' sentence must NOT embed the source — keep fact text clean. "
            "Bullets are short, punchy, one sentence each, MAX 80 CHARACTERS per bullet — lead with the point, no preamble. "
            "Prioritize specificity over breadth. No filler. No vague generalities. "
            "Use current real-world data from your search results where available. "
            "Return ONLY valid JSON. No markdown. No preamble."
        )

    result = await _call(
        system=system,
        user=user_prompt,
        max_tokens=2000,
        use_search=(PROVIDER == "gemini"),
    )
    if isinstance(result, tuple):
        raw, gemini_sources = result
        sources = gemini_sources if gemini_sources else sources
    else:
        raw = result

    parsed = _extract_json(raw)
    # Ensure expected structure
    if "bottom_line" not in parsed:
        parsed["bottom_line"] = ""
    if "hard_facts" not in parsed:
        parsed["hard_facts"] = []
    if "bullets" not in parsed:
        parsed["bullets"] = []
    return parsed, sources


async def generate_metadata(thesis: str, steel_man: str, image_b64: str | None = None, image_media_type: str = "image/jpeg") -> dict:
    """Generate take strength score (0-100), topic tags, and evidence type label."""
    system = (
        "You are evaluating the argumentative strength of hot takes — subjective positions on media, tech, culture, and ideas. "
        "You score takes on how sharp, specific, and arguable they are, not on factual correctness. "
        "If an image is provided, use it as evidence of what is being claimed. "
        "You always return valid JSON when asked."
    )

    prompt = f"""Thesis: {thesis}

This is a CONVICTION SCORE — 0 to 100. It combines factual accuracy with the strength of the argument.

The two anchors:
- A verifiably TRUE statement scores near 100. The truer and more provable, the higher.
- A verifiably FALSE or demonstrably wrong statement scores near 0. The more clearly false, the lower.
- Opinions and takes that can't be proven score in the middle — higher if the argument is tight and evidence leans that way, lower if it's vague or unsupported.

SCORING SCALE:
90–100 — Verifiably true. Established fact, empirically confirmed, or a prediction that has already proven correct.
75–89  — Well-evidenced and hard to dismiss. Strong case, evidence leans clearly in this direction.
55–74  — Reasonable and defensible. Solid argument, some supporting evidence, but genuinely contestable.
35–54  — Contested or underdeveloped. Possible but the argument is thin, vague, or the evidence is weak.
15–34  — Unlikely or poorly supported. Speculative with little backing, or goes against available evidence.
0–14   — Demonstrably false or incoherent. Contradicts established facts or makes no logical sense.

CALIBRATION EXAMPLES — match your scores to these:
- "Apples are a type of fruit." → 99 (pure verified fact)
- "Regular sleep of 7–9 hours improves cognitive performance." → 93 (scientifically established)
- "Social media has increased political polarization." → 78 (well-evidenced, strong academic consensus)
- "The newsletter subscription boom peaked around 2022–2023." → 65 (directionally supported, observable data)
- "No media operator has ever genuinely benefited from taking VC money." → 52 (arguable point, but counterexamples exist — hyperbole counts against it)
- "Podcasting rewards authenticity over production quality." → 48 (plausible conventional wisdom, limited hard evidence)
- "Every major ad holding company will be gone within 8 years." → 38 (bold prediction, no current evidence, speculative)
- "Bari Weiss is single-handedly destroying CBS News." → 18 (hyperbolic, not supported by evidence)
- "Canada will be a global superpower by 2030." → 8 (contradicts all available economic and geopolitical data)

Use the FULL range. Don't default to 55–65 for everything in the middle.
Hyperbole for effect is fine — score the underlying claim, not the literal wording.
If an image is provided, use it as direct evidence for the claim.

Return a JSON object with exactly these keys:
{{
  "score": <integer 0-100>,
  "tags": ["2-4 short topic tags"],
  "evidence_type": "<one of: Empirical | Observational | Anecdotal | Speculative>",
  "category": "<one of: Politics | Business | Media | AI & Tech | Health & Science | Entertainment | Sports | History | Other>"
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


async def _judge_strength(thesis: str, steel_man_json: dict, counterpoint: dict) -> str:
    """Independent judge rates counterpoint strength — separate call, no authorship bias."""
    sm_text = steel_man_json.get("bottom_line", "")
    sm_bullets = steel_man_json.get("bullets", [])
    if sm_bullets:
        sm_text += "\n" + "\n".join(f"- {b}" for b in sm_bullets)

    cp_text = counterpoint.get("bottom_line", "")
    cp_bullets = counterpoint.get("bullets", [])
    if cp_bullets:
        cp_text += "\n" + "\n".join(f"- {b}" for b in cp_bullets)

    prompt = (
        f"You are an independent judge evaluating a counterargument. You did NOT write it.\n\n"
        f"THESIS: {thesis}\n\n"
        f"STEELMAN (best case FOR the thesis):\n{sm_text}\n\n"
        f"COUNTERPOINT to evaluate:\n{cp_text}\n\n"
        "Rate the strength of this counterpoint:\n"
        "- weak: thesis mostly survives, counterpoint is nitpicking or misses the core claim\n"
        "- moderate: real holes found but thesis is still defensible with adjustments\n"
        "- strong: significant damage done, thesis needs major revision\n"
        "- devastating: thesis collapses entirely under this counterpoint\n\n"
        "Be ruthlessly honest. A counterpoint that attacks peripheral details while the core thesis "
        "stands is WEAK, not strong. If the thesis can retreat to a defensible position, it is at most MODERATE.\n\n"
        'Return JSON only: {"strength": "<weak|moderate|strong|devastating>"}'
    )
    try:
        raw = await _call(
            system="You are a rigorous independent debate judge. Return only valid JSON.",
            user=prompt,
            max_tokens=60,
        )
        if isinstance(raw, tuple):
            raw = raw[0]
        result = _extract_json(raw)
        strength = result.get("strength", "").lower()
        if strength in ("weak", "moderate", "strong", "devastating"):
            print(f"[judge] self-rated: {counterpoint.get('strength')} → judge: {strength}")
            return strength
    except Exception as e:
        print(f"[judge] failed, keeping self-rating: {e}")
    return counterpoint.get("strength", "moderate")


async def generate_counterpoint(thesis: str, steel_man_json: dict) -> tuple[dict, list[dict]]:
    """Generate an aggressive counterpoint to the steelman.
    Returns (counterpoint_dict, sources) where counterpoint_dict = {bottom_line, bullets, verdict, strength}."""
    search_context, sources = "", []
    if PROVIDER == "anthropic" and settings.tavily_api_key:
        search_context, sources = await _search_tavily(f"counterarguments against: {thesis}")

    steel_man_text = steel_man_json.get("bottom_line", "")
    bullets = steel_man_json.get("bullets", [])
    if bullets:
        steel_man_text += "\n" + "\n".join(f"• {b}" for b in bullets)

    prompt = f"""Thesis: {thesis}

Steelman argument:
{steel_man_text}"""

    if search_context:
        prompt += f"\n\nCurrent real-world context:\n{search_context}"

    prompt += """

Now tear this thesis apart. You are the opposing counsel. Build the most aggressive, evidence-based case AGAINST this thesis.

Return a JSON object with exactly these keys:
{
  "bottom_line": "1 punchy sentence — the single most devastating argument against this thesis.",
  "bullets": ["3-4 attacks — each ONE sentence max, sharp and direct. No throat-clearing. Lead with the point."],
  "hard_facts": [{"fact": "specific data point, one clean sentence, no source in the sentence", "source": "Source Name, Year"}],
  "verdict": "2-3 sentences — after weighing steelman and counterpoint, does the original thesis survive?",
  "strength": "<one of: weak | moderate | strong | devastating>"
}

The 'strength' field rates how powerful this counterpoint is:
- weak: the thesis mostly survives, counterpoint is nitpicking
- moderate: real holes found but thesis still has merit
- strong: significant damage to the thesis, major revision needed
- devastating: thesis collapses under scrutiny

Return valid JSON only. No markdown fences. No preamble."""

    result = await _call(
        system=(
            "You are a brilliant, aggressive opposing counsel. "
            "Your job: destroy this thesis with hard evidence and sharp logic. "
            "You are not balanced — you are adversarial. But intellectually honest. "
            "HARD FACTS are your ammunition: prioritize data from government agencies (BLS, Census Bureau, CDC, Federal Reserve, CBO, OECD, World Bank, IMF, WHO, NIH, etc.) "
            "and peer-reviewed research. Each hard_fact is an object: { fact, source, url }. The 'fact' sentence must NOT embed the source — keep fact text clean. "
            "Bullets are short, punchy, one sentence each, MAX 80 CHARACTERS per bullet — lead with the attack, no preamble. "
            "Target specific weaknesses: wrong data, missing context, logical fallacies, contrary evidence. "
            "Use current search results where available. "
            "Return ONLY valid JSON. No markdown. No preamble."
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

    parsed = _extract_json(raw)
    for key in ("bottom_line", "hard_facts", "bullets", "verdict", "strength"):
        if key not in parsed:
            parsed[key] = [] if key in ("hard_facts", "bullets") else ""

    # Replace self-rated strength with independent judge rating
    parsed["strength"] = await _judge_strength(thesis, steel_man_json, parsed)

    return parsed, sources


# ─── PvA Take ───────────────────────────────────────────────────────────

import os as _os
import glob as _glob

PVA_TRANSCRIPTS_DIR = _os.path.join(_os.path.dirname(__file__), "pva_transcripts")

PVA_COMPOSITE_VOICE = """You are the editorial voice of People vs Algorithms (PvA) — a podcast and newsletter \
by Troy Young, Brian Morrissey, and Alex Schleifer about media, technology, and culture. \
Your job is to react to a claim the way this show would — sharp, opinionated, connected to bigger patterns.

THE THREE VOICES:

TROY YOUNG — former Hearst digital chief, media strategist, builder. His voice:
- Thinks in systems: "if everything in media is downstream of a system..."
- Uses "tectonic" for structural shifts. "Right?" as a conversational filler.
- Calls out hype cold: "Who cares? Seriously. Who cares?"
- Warm, dry humor: "God bless you." "Like fancy McDonald's." "That's what happened."
- Named industry winners and losers by name, from personal knowledge.
- Pattern: long analytical build → pithy one-liner close.
- "The one and only [name]" — insider familiarity with industry figures.
- Talks about: creator economy, ad tech, platform power, luxury media strategy, AI disruption of publishing.
- Frames things as power dynamics: who wins, who loses, where does value accrue.
- Print-to-digital transition expert. Deeply knows the magazine/publisher world.
- "I dare I use the word..." — self-aware about industry jargon.

BRIAN MORRISSEY — former Digiday editor-in-chief, host, cultural commentator. His voice:
- Drives conversation. Structures arguments. Anchors the show.
- World-weary but engaged: "This tech stuff is just too depressing to be honest with you."
- Sharp editorial instincts: "It is not a feed, it's a question and answer."
- "Welcome to People versus Algorithms. A show about connecting the dots in media, technology, and culture."
- Calls out BS with precision. Lists his observations clearly.
- References deals, M&A, industry moves, specific numbers.
- Sardonic: "I can't believe young people go into this industry."

ALEX SCHLEIFER — former Anthropic design, VC/startup world, tech optimist. His voice:
- Product and design lens on media/tech problems.
- More bullish on AI and new platforms than the others.
- Gets excited about specific products: "it's really fast." "it's a miracle."
- Occasionally plays devil's advocate.
- Venture/startup cultural references.

THE SHOW'S DNA:
- "Connecting the dots" — explicit framing. Nothing exists in isolation.
- Insider perspective. They know everyone in the industry personally.
- Pro-business but deeply skeptical of hype and power consolidation.
- Topics: Substack, NYT, Atlantic, creator economy, programmatic advertising, platform economics, AI, streaming, podcasting, sports media, luxury brands, talent economics.
- Recurring thesis: everything in media/culture is downstream of systems and power. Who controls distribution controls everything.
- Tone: smart friends at dinner, after a few drinks, who actually built these businesses.
- Not academic. Not preachy. Not neutral. Takes positions.
- Comfortable with profanity when the moment calls for it.
- References art, design, food, sport — not just tech.
- Short punchy sentences. Contractions. Real speech patterns.
- Dry humor is the default register. Earnestness is earned."""


def _episode_sort_key(path: str) -> tuple:
    """Sort key: z_ curated files first, then by season+episode descending (newest first)."""
    name = _os.path.basename(path)
    if name.startswith("z_"):
        return (0, 0, 0)  # highest priority
    import re as _re
    m = _re.search(r'[Ss](\d+)[Ee](\d+)', name)
    if m:
        return (1, -int(m.group(1)), -int(m.group(2)))  # newest episodes first
    return (2, 0, 0)  # other files last


def _load_transcript_context() -> str:
    """Load PvA transcripts as voice-training context.
    Loads z_ curated excerpts first, then full episodes newest-first (S4→S3→S2→S1).
    Skips the first 1500 chars of full episodes (avoids small-talk openers).
    Budget: up to 10 files, 4000 chars each, 30000 total."""
    if not _os.path.isdir(PVA_TRANSCRIPTS_DIR):
        return ""
    all_files = _glob.glob(_os.path.join(PVA_TRANSCRIPTS_DIR, "*.txt"))
    if not all_files:
        return ""
    all_files.sort(key=_episode_sort_key)
    chunks = []
    total = 0
    for f in all_files[:10]:
        try:
            with open(f, "r") as fh:
                text = fh.read().strip()
            name = _os.path.basename(f)
            # Skip opener small-talk for full episode files
            offset = 0 if name.startswith("z_") else 1500
            excerpt = text[offset:offset + 4000]
            if excerpt:
                chunks.append(f"[{name}]\n{excerpt}")
                total += len(excerpt)
            if total > 30000:
                break
        except Exception:
            continue
    if not chunks:
        return ""
    return (
        "\n\nREFERENCE — PvA podcast excerpts (match this tone, vocabulary, and analytical style exactly):\n\n"
        + "\n\n---\n\n".join(chunks)
    )


async def generate_pva_take(thesis: str, steel_man_json: dict, voice: str = "all") -> dict:
    """Generate a PvA-voice reaction to the thesis.
    Returns {body: str, tldr: str, voice: str}."""

    steel_man_text = steel_man_json.get("bottom_line", "")
    bullets = steel_man_json.get("bullets", [])
    if bullets:
        steel_man_text += "\n" + "\n".join(f"• {b}" for b in bullets)

    transcript_context = _load_transcript_context()

    system = (
        f"{PVA_COMPOSITE_VOICE}\n"
        "Return ONLY valid JSON. No markdown fences. No preamble."
    )

    prompt = f"""Thesis: {thesis}

Steelman:
{steel_man_text}{transcript_context}

React to this claim in the PvA voice. You may agree, disagree, or completely reframe the question.
Connect it to bigger patterns in media, tech, or culture where relevant.

Return a JSON object:
{{
  "bottom_line": "1-2 sentences — the PvA verdict on this claim. Punchy, opinionated, conversational.",
  "bullets": ["3-5 sharp observations — each 1-2 sentences, conversational tone, connect to bigger patterns in media/tech/culture"],
  "tldr": "One punchy sentence — the single-line PvA take."
}}

Return valid JSON only. No markdown fences. No preamble."""

    result = await _call(
        system=system,
        user=prompt,
        max_tokens=2000,
    )

    if isinstance(result, tuple):
        raw = result[0]
    else:
        raw = result

    parsed = _extract_json(raw)
    parsed["voice"] = "pva"
    return parsed


# ─── Legacy alias ───────────────────────────────────────────────────────

async def generate_stress_test(thesis: str, steel_man: str) -> tuple[dict, list[dict]]:
    """Legacy wrapper — converts old-format call to new counterpoint."""
    # Parse steel_man text into the new JSON format for counterpoint
    bullets = [l.replace("•", "").strip() for l in steel_man.split("\n") if l.strip()]
    sm_json = {"bottom_line": bullets[0] if bullets else "", "bullets": bullets[1:] if len(bullets) > 1 else bullets}
    return await generate_counterpoint(thesis, sm_json)


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


async def generate_joke(thesis: str) -> str:
    """Generate a one-sentence Brian Morrissey-voice reaction to the thesis."""
    transcript_context = _load_transcript_context()
    system = (
        "You are Brian Morrissey, co-host of People vs Algorithms. "
        "Brian is a former editor of Adweek and Digiday, deeply knowledgeable about media, publishing, advertising, and the tech industry's effect on culture. "
        "He's witty, intellectually generous, and sees the structural forces others miss. "
        "He's skeptical but not cynical — he gives ideas a fair hearing before puncturing them. "
        "He thinks in systems and business models. He's comfortable being funny but never at the expense of insight. "
        "Respond to the claim in exactly ONE sentence. Make it feel like something Brian would actually say — not a hot take, not a lecture, just a sharp, considered reaction. "
        "No preamble, no quotation marks, no explanation."
        + transcript_context
    )
    result = await _call(
        system=system,
        user=f"React to this claim in one sentence: {thesis}",
        max_tokens=100,
    )
    return result.strip() if isinstance(result, str) else result[0].strip()


async def negate_thesis(thesis: str) -> str:
    """Return the logical opposite of a thesis as a punchy statement."""
    result = await _call(
        system="You are a debate coach. Flip the thesis into its strongest opposing claim. One sentence, punchy and direct. No preamble.",
        user=f"Original thesis: {thesis}\n\nWrite the opposing thesis:",
        max_tokens=100,
    )
    return result.strip() if isinstance(result, str) else result[0].strip()
