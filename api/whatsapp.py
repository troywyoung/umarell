"""
WhatsApp webhook — receives messages via Twilio, runs them through the
hot-take pipeline, and replies with the steelmanned take + score.

Modes:
  • Direct message: any text → processed as a take
  • Group: only messages starting with 🔥 or /take are processed
           e.g. "🔥 Podcasts are replacing newspapers"
           e.g. "/take AI will commoditize all knowledge work"

Setup:
  1. Twilio account + WhatsApp Sandbox
  2. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER in .env
  3. Point sandbox webhook to: https://<ngrok>/webhook/whatsapp
"""

import json
import logging
import os

from fastapi import APIRouter, Form, Request, Response
from twilio.twiml.messaging_response import MessagingResponse

from database import AsyncSessionLocal
from models import Observation
from pipeline import format_thesis, generate_metadata, generate_steel_man

logger = logging.getLogger(__name__)

router = APIRouter()

TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")

# Triggers that activate the bot in group chats
GROUP_TRIGGERS = ["🔥", "/take", "/hottake"]


def _is_group(from_: str) -> bool:
    """Twilio sends group messages with a From containing '@g.us'."""
    return "@g.us" in from_


def _strip_trigger(text: str) -> str | None:
    """Return text with trigger removed, or None if no trigger found."""
    for trigger in GROUP_TRIGGERS:
        if text.lower().startswith(trigger.lower()):
            return text[len(trigger):].strip()
    return None


def _twiml_reply(body: str) -> Response:
    resp = MessagingResponse()
    resp.message(body)
    return Response(content=str(resp), media_type="application/xml")


def _twiml_empty() -> Response:
    """Return empty 200 — used to silently ignore group messages."""
    return Response(content=str(MessagingResponse()), media_type="application/xml")


def _score_label(score: int) -> str:
    if score >= 90:   return "Verified"
    if score >= 75:   return "Well-backed"
    if score >= 55:   return "Defensible"
    if score >= 35:   return "Thin"
    if score >= 15:   return "Unlikely"
    return "False"


@router.post("/webhook/whatsapp")
async def whatsapp_webhook(
    request: Request,
    Body: str = Form(default=""),
    From: str = Form(default=""),
    ProfileName: str = Form(default=""),
):
    _ = request  # signature validation skipped in dev (ngrok changes URL)

    raw = Body.strip()
    sender = ProfileName or From.replace("whatsapp:", "")
    is_group = _is_group(From)

    if is_group:
        # In groups, only respond to triggered messages
        take_text = _strip_trigger(raw)
        if take_text is None:
            return _twiml_empty()
        if len(take_text) < 10:
            return _twiml_reply("Give me a full take — at least a sentence.")
    else:
        # DM — respond to anything
        take_text = raw
        if not take_text:
            return _twiml_reply("Send me a take and I'll steelman it. In a group chat, prefix with 🔥")
        if len(take_text) < 10:
            return _twiml_reply("That's a bit short — give me a full take to work with.")

    logger.info("[whatsapp] take from %s (%s): %s", sender, "group" if is_group else "dm", take_text[:80])

    try:
        thesis = await format_thesis(take_text, "text")
        steel_man_dict, _ = await generate_steel_man(thesis)
        steel_man_text = (
            steel_man_dict.get("bottom_line", "") + "\n\n" +
            "\n".join(f"• {b}" for b in steel_man_dict.get("bullets", []))
        )
        meta = await generate_metadata(thesis, json.dumps(steel_man_dict))
        score = meta.get("score", 0)
        label = _score_label(score)

        async with AsyncSessionLocal() as db:
            obs = Observation(
                raw_input=take_text,
                input_type="text",
                thesis=thesis,
                status="complete",
                score=score,
                tags=meta.get("tags", []),
                category=meta.get("category"),
                summary=json.dumps({**steel_man_dict, "source": f"WhatsApp — {sender}"}),
            )
            db.add(obs)
            await db.commit()

        reply = (
            f"*{thesis}*\n\n"
            f"{steel_man_text}\n\n"
            f"Conviction score: *{score}/100* ({label})\n\n"
            f"hottake.peoplevsalgorithms.com"
        )
        return _twiml_reply(reply)

    except Exception as e:
        logger.error("[whatsapp] pipeline error: %s", e, exc_info=True)
        return _twiml_reply("Something went wrong. Try again in a moment.")
