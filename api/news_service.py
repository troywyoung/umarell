"""
news_service.py — fetch top news stories and extract takes for news bundles.
"""
import asyncio
import json
import re
from datetime import datetime, timezone

import httpx

CATEGORIES = {
    "general":  "News",
    "business": "Business",
    "tech":     "Tech",
    "politics": "Politics",
    "gossip":   "Gossip",
}


async def fetch_hn_stories(count: int = 30) -> list[dict]:
    """Fetch top Hacker News stories."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get("https://hacker-news.firebaseio.com/v0/topstories.json")
        ids = resp.json()[:60]

        tasks = [
            client.get(f"https://hacker-news.firebaseio.com/v0/item/{sid}.json")
            for sid in ids[:count]
        ]
        responses = await asyncio.gather(*tasks, return_exceptions=True)

        stories = []
        for r in responses:
            if isinstance(r, Exception):
                continue
            try:
                item = r.json()
                if item and item.get("type") == "story" and item.get("title"):
                    stories.append({
                        "title":    item["title"],
                        "url":      item.get("url") or f"https://news.ycombinator.com/item?id={item['id']}",
                        "score":    item.get("score", 0),
                        "comments": item.get("descendants", 0),
                    })
            except Exception:
                continue

        return stories


async def extract_news_takes(stories: list[dict], category: str, count: int = 5) -> list[dict]:
    """Extract sharp takes from news headlines using the LLM."""
    from pipeline import _call

    category_label = CATEGORIES.get(category, "News")
    headlines_text = "\n".join(
        f'- "{s["title"]}" ({s["url"]})' for s in stories[:30]
    )

    system = (
        "You are extracting sharp, opinionated takes from news headlines. "
        "A take is not a summary — it's an argument. It says WHY something matters, "
        "WHAT it actually means, or WHAT will happen next. You always return valid JSON."
    )

    user_prompt = f"""Here are today's top news stories:

{headlines_text}

Extract the {count} most take-worthy stories, focused on {category_label}. \
For each, write a sharp take — not a restatement of the headline, \
but an argument about what it means or implies.

Each take must have:
- headline: the take as a sharp, arguable thesis (your words, not the original headline)
- context: 1-2 sentences of supporting reasoning or implication
- source_title: the original story title
- source_url: the original URL
- quality_score: 0-100 (how specific, falsifiable, and argumentative is this take?)

Only include takes where quality_score >= 65.

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
        source_title = (take.get("source_title") or "").strip()
        source_url   = (take.get("source_url") or "").strip()
        qs           = take.get("quality_score", 0)
        if not headline or not source_url:
            continue
        if not isinstance(qs, (int, float)) or qs < 65:
            continue
        filtered.append({
            "headline":     headline,
            "context":      context,
            "source_title": source_title,
            "source_url":   source_url,
            "quality_score": int(qs),
        })

    return filtered[:count]


def make_bundle_tag(category: str) -> str:
    now = datetime.now(timezone.utc)
    return f"news-{category}-{now.strftime('%Y-%m-%d-%H%M')}"


def make_bundle_title(category: str) -> str:
    category_label = CATEGORIES.get(category, "News")
    now = datetime.now(timezone.utc)
    day  = now.strftime("%a %b ") + str(now.day)   # "Mon Apr 7"
    hour = now.strftime("%I:%M %p").lstrip("0")    # "2:30 PM"
    return f"{category_label} Takes | {day} | {hour}"
