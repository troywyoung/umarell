"""
Design tokens for Umarell.

All design variables (colors, typography, spacing, etc.) are defined here.
Tokens can be modified via the admin interface.
"""

DESIGN_TOKENS = {
    "colors": {
        "primary": {
            "accent": "#FF00AE",
            "dark_bg": "#12102B",
            "light_bg": "#FAFAF8",
            "white": "#FFFFFF",
            "dark_text": "#1A1A1A"
        },
        "confidence_scores": {
            "undeniable": "#FF2FA3",
            "holds_water": "#4CAF50",
            "fighting_words": "#E8813A",
            "jurys_out": "#E7B84B",
            "weak_signal": "#3D5A9E",
            "unpersuasive": "#5A6B8C"
        },
        "backgrounds": {
            "modal": "#1C1C1C",
            "card_beige": "#F5F0E8",
            "card_white": "#FFFFFF",
            "challenge": "#EEF4FF",
            "secondary": "#F0F0ED"
        },
        "text": {
            "primary_dark": "#555",
            "secondary_dark": "#888",
            "tertiary_dark": "#999",
            "metadata": "#BBB",
            "light_secondary": "#CCC"
        },
        "ui": {
            "steel_blue": "#2C5ABA",
            "warm_gray": "#C8C4BC",
            "border_gray": "#666"
        }
    },
    "typography": {
        "fonts": {
            "system": "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif",
            "display": "'Besley', serif"
        },
        "sizes": {
            "xs": "10px",
            "sm": "12px",
            "base": "14px",
            "md": "16px",
            "lg": "18px",
            "xl": "22px",
            "2xl": "26px",
            "3xl": "27px"
        },
        "weights": {
            "semibold": 600,
            "bold": 700,
            "extrabold": 800,
            "black": 900
        },
        "letter_spacing": {
            "tighter": "-0.6px",
            "tight": "-0.4px",
            "normal": "0",
            "wide": "0.5px",
            "wider": "1px",
            "widest": "1.5px"
        },
        "line_heights": {
            "tight": 1,
            "snug": 1.27,
            "normal": 1.45,
            "relaxed": 1.6,
            "loose": 1.65
        }
    },
    "spacing": {
        "padding": {
            "xs": "4px",
            "sm": "8px",
            "base": "12px",
            "md": "16px",
            "lg": "20px",
            "xl": "24px",
            "2xl": "32px",
            "3xl": "40px"
        },
        "margin": {
            "xs": "4px",
            "sm": "8px",
            "base": "12px",
            "md": "16px",
            "lg": "20px",
            "xl": "24px",
            "2xl": "32px"
        },
        "gap": {
            "xs": "3px",
            "sm": "6px",
            "base": "8px",
            "md": "10px",
            "lg": "12px"
        }
    },
    "borders": {
        "radius": {
            "none": "0",
            "sm": "2px",
            "base": "6px",
            "md": "8px",
            "lg": "14px",
            "xl": "18px",
            "pill": "20px",
            "full": "50%"
        }
    },
    "shadows": {
        "card": "0 1px 6px rgba(0,0,0,0.06)",
        "popover": "0 12px 40px rgba(0,0,0,0.5)"
    },
    "layout": {
        "max_width": "480px",
        "min_height": "100vh"
    },
    "animations": {
        "durations": {
            "fast": "0.3s",
            "normal": "1s",
            "slow": "2.5s"
        },
        "easing": {
            "ease_in_out": "ease-in-out",
            "ease_out": "ease-out"
        }
    }
}


def get_design_tokens() -> dict:
    """Get all design tokens."""
    return DESIGN_TOKENS


def update_design_token(path: list[str], value: str) -> bool:
    """Update a design token value.

    Args:
        path: Path to the token (e.g., ['colors', 'primary', 'accent'])
        value: New value for the token

    Returns:
        True if updated successfully
    """
    current = DESIGN_TOKENS
    for key in path[:-1]:
        if key not in current:
            return False
        current = current[key]

    if path[-1] not in current:
        return False

    current[path[-1]] = value
    return True


def get_token_value(path: list[str]) -> str | None:
    """Get a design token value by path.

    Args:
        path: Path to the token (e.g., ['colors', 'primary', 'accent'])

    Returns:
        Token value or None if not found
    """
    current = DESIGN_TOKENS
    for key in path:
        if isinstance(current, dict) and key in current:
            current = current[key]
        else:
            return None
    return current if isinstance(current, str) else None
