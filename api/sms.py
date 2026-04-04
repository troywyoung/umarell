"""
SMS webhook — receives text messages via Twilio, runs them through the
hot-take pipeline, and replies with the steelmanned take + score.

Setup:
  1. Twilio account + phone number
  2. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN in .env
  3. Point the phone number's messaging webhook to: https://<domain>/webhook/sms
"""

import json
import logging

from fastapi import APIRouter, Form, Request, Response
from twilio.twiml.messaging_response import MessagingResponse

from database import AsyncSessionLocal
from models import Observation
from pipeline import format_thesis, generate_metadata, generate_steel_man

logger = logging.getLogger(__name__)

router = APIRouter()


def _score_label(score: int) -> str:
    if score >= 95:   return "Undeniable"
    if score >= 80:   return "Holds Water"
    if score >= 60:   return "Fighting Words"
    if score >= 41:   return "Jury\u2019s Out"
    if score >= 21:   return "Weak Signal"
    return "Unpersuasive"


def _twiml_reply(body: str) -> Response:
    resp = MessagingResponse()
    resp.message(body)
    return Response(content=str(resp), media_type="application/xml")


@router.post("/webhook/sms")
async def sms_webhook(
    request: Request,
    Body: str = Form(default=""),
    From: str = Form(default=""),
):
    _ = request

    raw = Body.strip()
    sender = From  # phone number e.g. +15551234567

    if not raw:
        return _twiml_reply("Send me a hot take and I'll steelman it.\nhottake.peoplevsalgorithms.com")
    if len(raw) < 10:
        return _twiml_reply("That's a bit short — give me a full take to work with.")

    logger.info("[sms] take from %s: %s", sender, raw[:80])

    try:
        thesis = await format_thesis(raw, "text")
        steel_man_dict, _ = await generate_steel_man(thesis)
        steel_man_text = (
            steel_man_dict.get("bottom_line", "") + "\n\n" +
            "\n".join(f"- {b}" for b in steel_man_dict.get("bullets", []))
        )
        meta = await generate_metadata(thesis, json.dumps(steel_man_dict))
        score = meta.get("score", 0)
        label = _score_label(score)

        async with AsyncSessionLocal() as db:
            obs = Observation(
                raw_input=raw,
                input_type="text",
                thesis=thesis,
                status="complete",
                score=score,
                tags=meta.get("tags", []),
                category=meta.get("category"),
                summary=json.dumps({**steel_man_dict, "source": f"SMS — {sender}"}),
            )
            db.add(obs)
            await db.commit()

        reply = (
            f"{thesis}\n\n"
            f"{steel_man_text}\n\n"
            f"Score: {score}/100 ({label})\n\n"
            f"hottake.peoplevsalgorithms.com"
        )
        return _twiml_reply(reply)

    except Exception as e:
        logger.error("[sms] pipeline error: %s", e, exc_info=True)
        return _twiml_reply("Something went wrong. Try again in a moment.")
