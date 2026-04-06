# Group design tokens into visual sections

Organize the 14 design tokens in the simplified design editor into semantic groups. Groups include Colors, Typography, and Layout to improve scanability and findability.

## Why

The current flat 2-column grid of 14 tokens provides no semantic organization. Grouping tokens by category makes it easier for users to quickly find and modify related tokens, reducing cognitive load when making design changes.

## Current State

SimplifiedDesignEditor (SimplifiedDesignEditor.tsx:15-358) displays all 14 tokens in a flat 2-column grid without any grouping or section headers. The tokens are:

Colors: primary_color, secondary_color, background_color, text_color
Typography: font_family_sans, font_family_serif, font_size_base, line_height_base
Layout: spacing_unit, container_max_width, border_radius_base, shadow_base, transition_duration, button_padding

## Desired Behavior

- Group tokens into three sections: Colors, Typography, Layout
- Add section headers to visually separate groups
- Maintain the current 2-column layout within each section
- Keep all tokens visible without tabs or accordions (no navigation overhead)
- Preserve existing color picker functionality for color tokens
- No change to save/revert functionality

## Technical Approach

- Modify SimplifiedDesignEditor component to render tokens in groups
- Add section headers with appropriate styling
- Reorder token rendering to match semantic grouping
- Ensure form state management works identically with grouped layout

## Principles

### Unsurprising UX

The user interface should be as "guessable" as possible.

Following the [Principle of Least Astonishment](https://en.wikipedia.org/wiki/Principle_of_least_astonishment), users form expectations about how a tool will behave based on conventions, prior experience, and intuition. Dust's interface (including the CLI) should match those expectations wherever possible. If users are observed trying to use the interface in ways we didn't anticipate, the interface should be adjusted to meet their expectations — even if that means supporting many ways of achieving the same result.

Surprising behavior erodes trust and slows people down. Unsurprising behavior lets users stay in flow.

### Small Units

Ideas, principles, facts, and tasks should each be as discrete and fine-grained as possible.

Small, focused documents enable precise relationships between them. A task can link to exactly the principles it serves. A fact can describe one specific aspect of the system. This granularity reduces ambiguity.

Tasks especially benefit from being small. A narrowly scoped task gives agents or humans the best chance of delivering exactly what was intended, in a single atomic commit.

### Prefer small executable tasks

This principle keeps agent work concrete and safe.

- Prefer tasks that can be completed and verified in one session.
- Write tasks in terms of visible outcomes, not vague investigation.
- Capture current reality as facts before changing system behavior.
- Use ideas for later possibilities and tasks for immediate execution.

## Task Type

implement

## Blocked By

(none)

## Definition of Done

- Design tokens are organized into three visual sections: Colors, Typography, Layout
- Section headers clearly label each group
- All tokens remain visible without additional navigation
- Existing functionality (color pickers, save, revert) works unchanged
- Implementation is complete and can be tested end-to-end
- Changes are committed atomically with this task file deleted
