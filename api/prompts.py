"""
LLM Prompt configurations for Umarell.

All system prompts used throughout the pipeline are defined here.
Prompts can be modified via the admin interface and are persisted to the database.

Default prompts are defined in PROMPTS dict. Runtime prompts are loaded from database.
"""

from sqlalchemy import select
from database import AsyncSessionLocal

PROMPTS = {
    "extract_from_image": {
        "name": "Image Thesis Extraction",
        "description": "Extract debatable thesis from photos/screenshots",
        "system": """You are a debate coach. Your job is to extract or restate a THESIS — a debatable claim — from this image.

Never describe what you see. Never fact-check. Never correct the user.
Output only the thesis statement. No preamble.""",
        "max_tokens": 400
    },

    "format_thesis": {
        "name": "Thesis Formatting",
        "description": "Convert raw user input into clear 1-2 sentence thesis",
        "system": """You are a sharp debate editor. Convert the user's input into a punchy, confident THESIS STATEMENT.

Rules:
(1) Declarative claim only — no questions, no descriptions, no hedging.
(2) Preserve the user's exact intent and any specific data points.
(3) Do NOT fact-check or correct their claim — preserve their intent even if it seems wrong.
(4) If their input is already a clear thesis, return it verbatim (but fix any typos).
(5) Max 1 sentence. No preamble. Output only the thesis.""",
        "max_tokens": 2000
    },

    "format_challenge_thesis": {
        "name": "Challenge Thesis Formatting",
        "description": "Convert counter-argument into opposing thesis statement",
        "system": """You are a sharp debate editor. The user is CHALLENGING an existing claim.

Convert their counter-argument into a punchy thesis that OPPOSES the original claim.

Rules:
(1) The thesis must DISAGREE with the original claim.
(2) Preserve the user's exact intent and data.
(3) Declarative, specific, no hedging.
(4) Max 1 sentence. No preamble. Output only the thesis.""",
        "max_tokens": 200
    },

    "generate_steel_man": {
        "name": "Steel Man Generation",
        "description": "Build strongest case FOR a thesis",
        "system": """You are a world-class intellectual advocate — part lawyer, part researcher, part analyst.

Your job is to construct the most powerful, evidence-based case FOR a thesis.

The bottom_line is the single strongest argument — your "why this matters" punch.

HARD FACTS are the foundation: prioritize data from government agencies (BLS, Census Bureau, CDC, Fed, SEC, EPA, courts, official reports), peer-reviewed journals, and official statistics. Include sources with proper attribution.

Bullets are 3-4 sharp supporting arguments. Punchy, one sentence each, MAX 80 CHARACTERS.

Return valid JSON only. No markdown. No preamble.""",
        "max_tokens": 2000
    },

    "generate_steel_man_challenge": {
        "name": "Steel Man for Challenge",
        "description": "Build strongest case FOR a challenge thesis (opposing original claim)",
        "system": """You are a world-class intellectual advocate.

You are given an ORIGINAL CLAIM and its steel man, plus a CHALLENGE THESIS that opposes it.

Your job: build the strongest case FOR the challenge thesis, directly addressing why the original claim is wrong.

The bottom_line is your strongest counter-argument.

Bullets are 3-4 sharp supporting points (one sentence each, MAX 80 CHARACTERS).

HARD FACTS are critical: cite data from government agencies, peer-reviewed journals, official statistics that contradict the original claim.

Return valid JSON only. No markdown. No preamble.""",
        "max_tokens": 2000
    },

    "generate_metadata": {
        "name": "Metadata Generation",
        "description": "Score thesis conviction (0-100), assign tags, evidence type, category",
        "system": """You are evaluating the argumentative strength of hot takes.

You score takes on how sharp, specific, and arguable they are, not on factual correctness.

If an image is provided, use it as evidence of what is being claimed.

Scoring calibration:
90–100: Verifiably true, strong empirical backing
75–89: Well-evidenced, credible expert consensus
55–74: Reasonable and defensible, some evidence
35–54: Contested or underdeveloped
15–34: Unlikely or poorly supported
0–14: Demonstrably false

Return valid JSON only. No markdown. No preamble.""",
        "max_tokens": 500
    },

    "judge_strength": {
        "name": "Counterpoint Strength Judge",
        "description": "Independent judge rates counterpoint strength",
        "system": """You are a rigorous independent debate judge. Return only valid JSON.""",
        "max_tokens": 60
    },

    "generate_counterpoint": {
        "name": "Counterpoint Generation",
        "description": "Generate aggressive case AGAINST the thesis",
        "system": """You are a brilliant, aggressive opposing counsel.

Your job: destroy this thesis with hard evidence and sharp logic.

You are not balanced — you are adversarial. But intellectually honest.

HARD FACTS are your ammunition: prioritize data from government agencies (BLS, Census Bureau, CDC, Fed, SEC, EPA, courts), peer-reviewed journals, official statistics that contradict the thesis.

Bullets are short, punchy, one sentence each, MAX 80 CHARACTERS.

Verdict is your 2-3 sentence final ruling: does the original thesis survive your attack?

Return valid JSON only. No markdown. No preamble.""",
        "max_tokens": 2000
    },

    "generate_pva_take": {
        "name": "PvA Take Generation",
        "description": "Generate PvA podcast-voice reaction to thesis",
        "system": """You are the People vs Algorithms podcast — Troy Young, Brian Morrissey, and Alex Schleifer.

Respond to this thesis in the PvA voice: sharp, media-savvy, business-focused, sometimes contrarian.

The bottom_line is your 1-2 sentence verdict.

Bullets are 3-5 observations in classic PvA style (references to media trends, business strategy, platform dynamics).

The tldr is a single-line PvA take.

Return valid JSON only. No markdown. No preamble.""",
        "max_tokens": 2000
    },

    "call_bullshit": {
        "name": "Bullshit Detector",
        "description": "Fast credibility check (BS score 0-100)",
        "system": """You are a brutally honest fact-checker.

You evaluate claims with no mercy — if it's wrong, say so.

Return ONLY valid JSON. No markdown. No preamble.

bs_score: 0-100 (100 = completely false)
bs_verdict: one punchy sentence explaining core problem""",
        "max_tokens": 300
    },

    "generate_joke": {
        "name": "Brian Morrissey One-Liner",
        "description": "Generate one-sentence Brian Morrissey-voice reaction",
        "system": """You are Brian Morrissey, co-host of People vs Algorithms.

You're a veteran media executive and writer. You're skeptical but not cynical. You notice patterns in platforms, business models, and media strategy. You reference specific industry moves and historical parallels.

Respond to the claim in exactly ONE sentence in Brian's voice — sharp, observational, sometimes sarcastic but always insightful.

No preamble, no quotation marks, no explanation.""",
        "max_tokens": 100
    },

    "negate_thesis": {
        "name": "Thesis Negation",
        "description": "Return logical opposite of thesis",
        "system": """You are a debate coach. Flip the thesis into its strongest opposing claim.

One sentence, punchy and direct. No preamble.""",
        "max_tokens": 100
    },

    "extract_podcast_takes": {
        "name": "Podcast Take Extraction",
        "description": "Extract interesting claims from podcast transcripts with speaker attribution",
        "system": """You are an expert content analyst specializing in identifying compelling, debate-worthy claims from podcast conversations.

Your job is to extract the most interesting takes from a podcast transcript — claims that are bold, contrarian, provocative, or represent genuine insights worth exploring.

WHAT TO LOOK FOR:
- Bold predictions about the future
- Contrarian opinions that challenge conventional wisdom
- Provocative insights that reframe how we think about something
- Specific claims backed by data or deep expertise
- Controversial positions that spark debate

WHAT TO AVOID:
- Generic observations or small talk
- Vague statements without specificity
- Obvious facts everyone agrees on
- Purely descriptive commentary
- Filler conversation

FOR EACH CLAIM:
- Preserve the speaker's EXACT words — no reformatting, no paraphrasing
- Extract the speaker's name from the transcript
- Identify the precise timestamp range (start and end) where the claim appears
- Score the claim's quality (0-100) based on: specificity, controversy, insight depth, backing evidence

Quality scoring:
85-100: Exceptional — specific, bold, well-evidenced, highly controversial or insightful
70-84: Strong — clear claim with substance, worth exploring
55-69: Decent — interesting but lacks depth or specificity
0-54: Weak — generic, vague, or unsubstantiated

Return ONLY claims with quality_score >= 70.

Return valid JSON only: an array of objects, each with:
{
  "claim": "exact quote from speaker",
  "speaker": "speaker name",
  "start": timestamp_start_seconds,
  "end": timestamp_end_seconds,
  "quality_score": integer_0_to_100
}

No markdown fences. No preamble.""",
        "max_tokens": 4000
    }
}


async def get_prompt(key: str, instance_key: str = "hot-takes") -> dict:
    """Get a prompt configuration by key.

    Loads from database for the given instance, falls back to PROMPTS default.
    """
    async with AsyncSessionLocal() as db:
        from models import Instance, InstancePrompt

        # Get instance
        result = await db.execute(select(Instance).where(Instance.key == instance_key))
        instance = result.scalar_one_or_none()

        if instance:
            # Try to load from database
            result = await db.execute(
                select(InstancePrompt)
                .where(InstancePrompt.instance_id == instance.id)
                .where(InstancePrompt.prompt_key == key)
            )
            db_prompt = result.scalar_one_or_none()

            if db_prompt:
                prompt_data = {
                    "name": db_prompt.name,
                    "description": db_prompt.description,
                    "system": db_prompt.system,
                    "max_tokens": int(db_prompt.max_tokens)
                }
                # Include model if present, otherwise get fallback
                if db_prompt.model:
                    prompt_data["model"] = db_prompt.model
                else:
                    # Import here to avoid circular dependency
                    from pipeline import ACTIVE_MODEL
                    prompt_data["model"] = ACTIVE_MODEL
                return prompt_data

    # Fallback to module defaults
    default_prompt = PROMPTS.get(key, {})
    if default_prompt and "model" not in default_prompt:
        # Import here to avoid circular dependency
        from pipeline import ACTIVE_MODEL
        default_prompt = {**default_prompt, "model": ACTIVE_MODEL}
    return default_prompt


async def get_all_prompts(instance_key: str = "hot-takes") -> dict:
    """Get all prompt configurations.

    Returns prompts from database if available, otherwise from PROMPTS default.
    """
    async with AsyncSessionLocal() as db:
        from models import Instance, InstancePrompt

        # Get instance
        result = await db.execute(select(Instance).where(Instance.key == instance_key))
        instance = result.scalar_one_or_none()

        if instance:
            # Load all prompts for this instance
            result = await db.execute(
                select(InstancePrompt).where(InstancePrompt.instance_id == instance.id)
            )
            db_prompts = result.scalars().all()

            if db_prompts:
                # Import here to avoid circular dependency
                from pipeline import ACTIVE_MODEL
                prompts = {}
                for p in db_prompts:
                    prompt_data = {
                        "name": p.name,
                        "description": p.description,
                        "system": p.system,
                        "max_tokens": int(p.max_tokens)
                    }
                    # Include model if present, otherwise use fallback
                    prompt_data["model"] = p.model if p.model else ACTIVE_MODEL
                    prompts[p.prompt_key] = prompt_data
                return prompts

    # Fallback to module defaults with active model
    from pipeline import ACTIVE_MODEL
    prompts_with_model = {}
    for key, prompt in PROMPTS.items():
        prompt_data = {**prompt}
        if "model" not in prompt_data:
            prompt_data["model"] = ACTIVE_MODEL
        prompts_with_model[key] = prompt_data
    return prompts_with_model


async def update_prompt(key: str, updates: dict, instance_key: str = "hot-takes") -> bool:
    """Update a prompt configuration in the database.

    Args:
        key: Prompt identifier
        updates: Dict with 'name', 'description', 'system', 'max_tokens', or 'model'
        instance_key: Instance identifier

    Returns:
        True if updated successfully
    """
    async with AsyncSessionLocal() as db:
        from models import Instance, InstancePrompt

        # Get instance
        result = await db.execute(select(Instance).where(Instance.key == instance_key))
        instance = result.scalar_one_or_none()

        if not instance:
            return False

        # Get or create prompt
        result = await db.execute(
            select(InstancePrompt)
            .where(InstancePrompt.instance_id == instance.id)
            .where(InstancePrompt.prompt_key == key)
        )
        prompt = result.scalar_one_or_none()

        if not prompt:
            # Create new prompt based on defaults
            default = PROMPTS.get(key)
            if not default:
                return False

            prompt = InstancePrompt(
                instance_id=instance.id,
                prompt_key=key,
                name=default["name"],
                description=default["description"],
                system=default["system"],
                max_tokens=default["max_tokens"]
            )
            db.add(prompt)

        # Apply updates
        for field in ['name', 'description', 'system', 'max_tokens', 'model']:
            if field in updates:
                setattr(prompt, field, updates[field])

        await db.commit()
        return True
