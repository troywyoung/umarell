"""
card_image.py — render a hottake card as a 600×280 PNG using Pillow.
Matches the app card design: white bg, colored score ring, dark text.
"""
import io
import json
import math
from PIL import Image, ImageDraw, ImageFont

CARD_W, CARD_H = 600, 280
BG        = (255, 255, 255)   # white card bg
DARK      = (26,  26,  26)    # #1A1A1A — thesis text
MID       = (100, 100, 100)   # bullet text
DIM       = (170, 170, 165)   # meta / secondary
DIVIDER   = (240, 237, 232)   # #F0EDE8 — border
ACCENT    = (255,   0, 174)   # #FF00AE — hot take / brand
PAD       = 24
RING_D    = 54                # outer diameter of score ring
RING_W    = 5                 # stroke width


def _score_color(v: int) -> tuple:
    if v <= 20: return (90,  107, 140)   # #5A6B8C
    if v <= 40: return (61,  90,  158)   # #3D5A9E
    if v <= 59: return (231, 184,  75)   # #E7B84B
    if v <= 79: return (232, 129,  58)   # #E8813A
    if v <= 94: return (76,  175,  80)   # #4CAF50
    return (255, 47, 163)                # #FF2FA3


def _score_tier(v: int) -> str:
    if v <= 20: return "Unpersuasive"
    if v <= 40: return "Weak Signal"
    if v <= 59: return "Jury's Out"
    if v <= 79: return "Fighting Words"
    if v <= 94: return "Holds Water"
    return "Undeniable"


def _load_fonts():
    bold_candidates = [
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    ]
    reg_candidates = [
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
    ]

    def first(paths, size):
        for p in paths:
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
        return ImageFont.load_default()

    return {
        "score_num":  first(bold_candidates, 18),
        "tier":       first(bold_candidates, 11),
        "thesis":     first(bold_candidates, 15),
        "bullet":     first(reg_candidates,  12),
        "brand_hot":  first(bold_candidates, 10),
        "brand_take": first(reg_candidates,  10),
        "cta":        first(bold_candidates, 10),
    }


def _wrap(text: str, font, max_w: int, draw: ImageDraw.ImageDraw) -> list[str]:
    lines, current = [], ""
    for word in text.split():
        candidate = (current + " " + word).strip()
        if draw.textlength(candidate, font=font) <= max_w:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def _draw_ring(draw: ImageDraw.ImageDraw, cx: int, cy: int,
               score: int, is_hot: bool):
    """Draw score ring: gray track + colored arc + number inside."""
    r = RING_D // 2
    fill_color = ACCENT if is_hot else _score_color(score)
    track_color = (230, 230, 228)

    # Track (full circle)
    for w in range(RING_W):
        rr = r - w
        draw.ellipse([cx-rr, cy-rr, cx+rr, cy+rr],
                     outline=track_color, width=1)

    # Arc fill
    if score > 0:
        end_angle = -90 + (score / 100 * 360)
        for w in range(RING_W):
            rr = r - w
            draw.arc([cx-rr, cy-rr, cx+rr, cy+rr],
                     start=-90, end=end_angle,
                     fill=fill_color, width=1)


def generate_card_image(obs: dict) -> bytes:
    fonts = _load_fonts()

    img  = Image.new("RGB", (CARD_W, CARD_H), BG)
    draw = ImageDraw.Draw(img)

    score     = int(obs.get("score") or 0)
    is_hot    = bool(obs.get("is_hot_take", False))
    thesis    = (obs.get("thesis") or obs.get("raw_input") or "").strip()
    user_name = (obs.get("user_name") or "").strip()

    ring_color = ACCENT if is_hot else _score_color(score)
    tier_label = "Hot Take" if is_hot else _score_tier(score)

    # ── Score ring (top-right, mirrors card layout) ───────────────────────────
    ring_r  = RING_D // 2
    ring_cx = CARD_W - PAD - ring_r
    ring_cy = PAD + ring_r + (6 if user_name else 0)
    _draw_ring(draw, ring_cx, ring_cy, score, is_hot)

    # Score number
    score_str = str(score) if score else "–"
    sw = draw.textlength(score_str, font=fonts["score_num"])
    bb = draw.textbbox((0, 0), score_str, font=fonts["score_num"])
    sh = bb[3] - bb[1]
    draw.text((ring_cx - sw / 2, ring_cy - sh / 2 - 1),
              score_str, font=fonts["score_num"], fill=ring_color)

    # Tier label below ring
    tier_w = draw.textlength(tier_label, font=fonts["tier"])
    draw.text((ring_cx - tier_w / 2, ring_cy + ring_r + 5),
              tier_label, font=fonts["tier"], fill=ring_color)

    # ── Author (if present) ───────────────────────────────────────────────────
    content_x = PAD
    y = PAD

    if user_name:
        draw.text((content_x, y), user_name, font=fonts["tier"],
                  fill=(*ACCENT,))
        y += 16

    # ── Thesis ────────────────────────────────────────────────────────────────
    max_thesis_w = CARD_W - PAD * 2 - RING_D - 16
    thesis_lines = _wrap(thesis, fonts["thesis"], max_thesis_w, draw)
    for line in thesis_lines[:5]:
        draw.text((content_x, y), line, font=fonts["thesis"], fill=DARK)
        y += 21

    # ── Bullets ───────────────────────────────────────────────────────────────
    bullets: list[str] = []
    raw_summary = obs.get("summary") or ""
    if raw_summary:
        try:
            sm = json.loads(raw_summary)
            bullets = sm.get("bullets") or []
        except Exception:
            pass

    if bullets:
        y += 4
        for bullet in bullets[:3]:
            dot_x = content_x + 2
            draw.text((dot_x, y), "·", font=fonts["bullet"], fill=DIM)
            draw.text((dot_x + 10, y), bullet[:85], font=fonts["bullet"], fill=MID)
            y += 17

    # ── Bottom bar ────────────────────────────────────────────────────────────
    bar_y = CARD_H - 34
    draw.line([(PAD, bar_y), (CARD_W - PAD, bar_y)], fill=DIVIDER, width=1)

    # "Add your take →" CTA in accent
    draw.text((PAD, bar_y + 10), "Add your take  →",
              font=fonts["cta"], fill=ACCENT)

    # Brand "hot" + "take" right-aligned
    bw_hot  = draw.textlength("hot",  font=fonts["brand_hot"])
    bw_take = draw.textlength("take", font=fonts["brand_take"])
    bx = CARD_W - PAD - bw_hot - bw_take
    by = bar_y + 10
    draw.text((bx, by),           "hot",  font=fonts["brand_hot"],  fill=ACCENT)
    draw.text((bx + bw_hot, by),  "take", font=fonts["brand_take"], fill=DIM)

    # Card border
    draw.rectangle([0, 0, CARD_W - 1, CARD_H - 1], outline=DIVIDER, width=1)

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()
