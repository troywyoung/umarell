"""
card_image.py — render a hottake observation as a 600×320 PNG using Pillow.
"""
import io
import json
import math
from PIL import Image, ImageDraw, ImageFont

CARD_W, CARD_H = 600, 320
BG        = (28, 28, 30)       # #1C1C1E
ORANGE    = (255, 107, 0)      # score arc / label
ACCENT    = (255, 0, 174)      # #FF00AE
WHITE     = (255, 255, 255)
DIM       = (160, 160, 162)    # bullet text
MID       = (80, 80, 82)       # bullet dot / lines
DARK_DIM  = (50, 50, 52)       # border / divider
PAD       = 28


def _load_fonts():
    paths = [
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
    ]
    bold_path = reg_path = None
    for p in paths:
        try:
            open(p)
            if "Bold" in p and bold_path is None:
                bold_path = p
            elif "Bold" not in p and reg_path is None:
                reg_path = p
        except FileNotFoundError:
            pass

    def load(path, size):
        if path:
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
        return ImageFont.load_default()

    return {
        "score":  load(bold_path, 17),
        "label":  load(bold_path, 13),
        "thesis": load(bold_path, 15),
        "bullet": load(reg_path,  12),
        "brand":  load(bold_path, 11),
        "cta":    load(bold_path, 11),
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


def _score_label(score: int, is_hot_take: bool) -> str:
    if is_hot_take:
        return "Hot Take"
    if score >= 80: return "Scorched Take"
    if score >= 70: return "Strong Take"
    if score >= 55: return "Solid Take"
    if score >= 35: return "Measured Take"
    return "Weak Signal"


def _draw_score_arc(draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int,
                    score: int, is_hot_take: bool):
    """Draw the score donut ring."""
    fill_color = ACCENT if is_hot_take else ORANGE

    # Background ring
    draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=(40, 40, 42))

    # Arc fill — approximate with pieslice method
    if score > 0:
        end_angle = -90 + (score / 100 * 360)
        # Draw arc using a series of lines for thickness
        for thickness in range(5):
            rr = r - thickness
            draw.arc(
                [cx-rr, cy-rr, cx+rr, cy+rr],
                start=-90,
                end=end_angle,
                fill=fill_color,
                width=1,
            )

    # Inner circle cutout
    ir = r - 7
    draw.ellipse([cx-ir, cy-ir, cx+ir, cy+ir], fill=BG)


def generate_card_image(obs: dict) -> bytes:
    fonts = _load_fonts()

    img  = Image.new("RGB", (CARD_W, CARD_H), BG)
    draw = ImageDraw.Draw(img)

    score      = int(obs.get("score") or 0)
    is_hot     = bool(obs.get("is_hot_take", False))
    thesis     = (obs.get("thesis") or obs.get("raw_input") or "").strip()
    arc_color  = ACCENT if is_hot else ORANGE
    label_text = _score_label(score, is_hot)

    # ── Score circle ─────────────────────────────────────────────────────────
    r  = 26
    cx = PAD + r
    cy = PAD + r
    _draw_score_arc(draw, cx, cy, r, score, is_hot)

    # Score number
    score_str = str(score) if score else "–"
    sw = draw.textlength(score_str, font=fonts["score"])
    # textbbox for vertical centering
    bb = draw.textbbox((0, 0), score_str, font=fonts["score"])
    sh = bb[3] - bb[1]
    draw.text((cx - sw / 2, cy - sh / 2 - 1), score_str,
              font=fonts["score"], fill=arc_color)

    # ── Score label ──────────────────────────────────────────────────────────
    lx = cx + r + 12
    ly = cy - 8
    if is_hot:
        draw.text((lx, ly), "🔥 " + label_text, font=fonts["label"], fill=ACCENT)
    else:
        draw.text((lx, ly), label_text, font=fonts["label"], fill=ORANGE)

    # ── Thesis ───────────────────────────────────────────────────────────────
    y = cy + r + 16
    thesis_lines = _wrap(thesis, fonts["thesis"], CARD_W - PAD * 2, draw)
    for line in thesis_lines[:4]:
        draw.text((PAD, y), line, font=fonts["thesis"], fill=WHITE)
        y += 22

    # ── Bullets ──────────────────────────────────────────────────────────────
    bullets: list[str] = []
    raw_summary = obs.get("summary") or ""
    if raw_summary:
        try:
            sm = json.loads(raw_summary)
            bullets = sm.get("bullets") or []
        except Exception:
            pass

    y += 6
    for bullet in bullets[:3]:
        draw.text((PAD, y), "·", font=fonts["bullet"], fill=MID)
        draw.text((PAD + 14, y), bullet[:90], font=fonts["bullet"], fill=DIM)
        y += 17

    # ── Bottom bar ───────────────────────────────────────────────────────────
    bar_y = CARD_H - 38
    draw.line([(PAD, bar_y), (CARD_W - PAD, bar_y)], fill=DARK_DIM, width=1)

    # CTA
    draw.text((PAD, bar_y + 11), "Add your take  →",
              font=fonts["cta"], fill=ACCENT)

    # Brand — "hot" in pink, "take" dimmed
    brand_w_hot  = draw.textlength("hot",  font=fonts["brand"])
    brand_w_take = draw.textlength("take", font=fonts["brand"])
    bx = CARD_W - PAD - brand_w_hot - brand_w_take
    by = bar_y + 11
    draw.text((bx, by),              "hot",  font=fonts["brand"], fill=ACCENT)
    draw.text((bx + brand_w_hot, by),"take", font=fonts["brand"], fill=MID)

    # Outer border
    draw.rectangle([0, 0, CARD_W - 1, CARD_H - 1], outline=DARK_DIM, width=1)

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()
