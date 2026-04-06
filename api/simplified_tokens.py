"""
Simplified design tokens for admin editing.

This module defines a strict, high-leverage subset of design tokens
that can be edited through the admin interface. These 14 tokens provide
maximum visual impact with minimal complexity.
"""

# High-leverage token set - fewer than 15 controls
SIMPLIFIED_TOKENS = {
    "primary_accent": "#FF00AE",
    "dark_background": "#12102B",
    "light_background": "#FAFAF8",
    "dark_text": "#1A1A1A",
    "secondary_background": "#F0F0ED",
    "card_background": "#FFFFFF",
    "border_radius": "8px",
    "base_font_size": "14px",
    "bold_font_weight": "700",
    "base_padding": "12px",
    "card_shadow": "0 1px 6px rgba(0,0,0,0.06)",
    "max_content_width": "480px",
    "button_color": "#FF00AE",
    "secondary_text": "#888"
}

# Mapping from simplified tokens back to full design token paths
TOKEN_MAPPINGS = {
    "primary_accent": ["colors", "primary", "accent"],
    "dark_background": ["colors", "primary", "dark_bg"],
    "light_background": ["colors", "primary", "light_bg"],
    "dark_text": ["colors", "primary", "dark_text"],
    "secondary_background": ["colors", "backgrounds", "secondary"],
    "card_background": ["colors", "backgrounds", "card_white"],
    "border_radius": ["borders", "radius", "md"],
    "base_font_size": ["typography", "sizes", "base"],
    "bold_font_weight": ["typography", "weights", "bold"],
    "base_padding": ["spacing", "padding", "base"],
    "card_shadow": ["shadows", "card"],
    "max_content_width": ["layout", "max_width"],
    "button_color": ["colors", "primary", "accent"],  # Same as primary accent
    "secondary_text": ["colors", "text", "secondary_dark"]
}

# Human-readable labels for the UI
TOKEN_LABELS = {
    "primary_accent": "Primary Accent Color",
    "dark_background": "Dark Background",
    "light_background": "Light Background",
    "dark_text": "Dark Text Color",
    "secondary_background": "Secondary Background",
    "card_background": "Card Background",
    "border_radius": "Border Radius",
    "base_font_size": "Base Font Size",
    "bold_font_weight": "Bold Font Weight",
    "base_padding": "Base Padding",
    "card_shadow": "Card Shadow",
    "max_content_width": "Max Content Width",
    "button_color": "Button Color",
    "secondary_text": "Secondary Text Color"
}

# Descriptions for each token
TOKEN_DESCRIPTIONS = {
    "primary_accent": "Main brand color used for buttons and highlights",
    "dark_background": "Background for dark mode or modal overlays",
    "light_background": "Main light background color",
    "dark_text": "Primary text color for dark text on light backgrounds",
    "secondary_background": "Subtle background for secondary elements",
    "card_background": "Background color for cards and panels",
    "border_radius": "Standard corner rounding for UI elements",
    "base_font_size": "Default text size throughout the app",
    "bold_font_weight": "Weight for bold text and headings",
    "base_padding": "Standard spacing inside containers",
    "card_shadow": "Drop shadow for cards and elevated elements",
    "max_content_width": "Maximum width for main content area",
    "button_color": "Color for primary action buttons",
    "secondary_text": "Color for secondary or less prominent text"
}


def get_simplified_tokens_from_full(full_tokens: dict) -> dict:
    """Extract simplified tokens from full design token structure."""
    simplified = {}

    for key, path in TOKEN_MAPPINGS.items():
        current = full_tokens
        for segment in path:
            if isinstance(current, dict) and segment in current:
                current = current[segment]
            else:
                # Fallback to default if path doesn't exist
                simplified[key] = SIMPLIFIED_TOKENS[key]
                break
        else:
            # Successfully navigated to the value
            simplified[key] = str(current)

    return simplified


def apply_simplified_tokens_to_full(simplified: dict, full_tokens: dict) -> dict:
    """Apply simplified token changes back to full design token structure."""
    import copy
    result = copy.deepcopy(full_tokens)

    for key, value in simplified.items():
        if key not in TOKEN_MAPPINGS:
            continue

        path = TOKEN_MAPPINGS[key]
        current = result

        # Navigate to the parent
        for segment in path[:-1]:
            if not isinstance(current, dict) or segment not in current or not isinstance(current[segment], dict):
                current[segment] = {}
            current = current[segment]

        # Set the value
        # Try to preserve type (int for weights, string for others)
        if key == "bold_font_weight":
            try:
                current[path[-1]] = int(value)
            except (ValueError, TypeError):
                current[path[-1]] = value
        else:
            current[path[-1]] = value

    return result
