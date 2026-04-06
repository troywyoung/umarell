# Design Control Improvements: Admin Page

Redesign the Design Tokens tab in the admin panel to follow the two-column pattern. Eliminate the preview pane and focus on clear, usable controls for editing design tokens.

## Context

The admin panel currently has three tabs:
1. **LLM Prompts** — Excellent two-column design (list + editor)
2. **Design Tokens** — Two implementations exist with different approaches
3. **Podcasts** — Simple single-column form

The Design Tokens tab has two implementations in the codebase:
- `SimplifiedDesignEditor.tsx` (used in standalone admin route) — compact, no preview, grid layout
- `DesignSystemSection.tsx` (used in AdminPanel) — split layout with preview pane

Current design tokens cover 14 high-leverage controls grouped into:
- **Colors** (8 tokens): primary_accent, button_color, dark_background, light_background, secondary_background, card_background, dark_text, secondary_text
- **Typography** (2 tokens): base_font_size, bold_font_weight
- **Layout** (4 tokens): border_radius, base_padding, max_content_width, card_shadow

## Design Vision

Create an interface you'd want to use — professional, efficient, and elegant. The user wants to:
- See all settings at a glance
- Make changes easily in a dedicated editor area
- Understand what each setting does without guesswork
- Get immediate visual feedback (via color pickers for colors)
- Save drafts locally and deploy to staging when ready

### Inspiration from Prompts Tab

The Prompts section demonstrates the ideal pattern:
- **Left column (300px fixed)**: List of all prompts, shows name + description, active selection highlighted
- **Right column (flex)**: Full editor for selected item with form fields, test tools, and actions
- **Bottom actions bar**: Consistent save/cancel buttons

Apply this same structure to Design Tokens.

## Proposed Design

### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│ Admin > Design Tokens                           [× Back]│
├───────────────┬─────────────────────────────────────────┤
│               │                                         │
│  Token List   │        Token Editor                     │
│  (300px)      │        (flex)                           │
│               │                                         │
│  Colors ▾     │  ┌─────────────────────────────┐       │
│   • Primary   │  │ Primary Accent Color        │       │
│     Accent    │  │ Main brand color used for   │       │
│   • Button    │  │ buttons and highlights      │       │
│     Color     │  │                             │       │
│   • Dark Bg   │  │ [●] #FF00AE ──────────────  │       │
│   • Light Bg  │  │                             │       │
│   • ...       │  └─────────────────────────────┘       │
│               │                                         │
│  Typography ▾ │  [Unsaved changes indicator]           │
│   • Base Font │                                         │
│   • Bold      │  [Revert to Default button]            │
│               │                                         │
│  Layout ▾     │                                         │
│   • Border    │                                         │
│   • Padding   │                                         │
│   • ...       │                                         │
│               │                                         │
├───────────────┴─────────────────────────────────────────┤
│                [Save Draft]  [Deploy to Staging]        │
└─────────────────────────────────────────────────────────┘
```

### Left Column: Token List

**Hierarchical navigation** organized by token category:
- Collapsible sections: Colors, Typography, Layout
- Each token shows its label (e.g., "Primary Accent Color")
- Visual indicator for currently selected token
- Compact, scannable list
- Show unsaved change indicator (dot or badge) next to modified tokens

**Interaction:**
- Click to select and load in editor
- Currently selected token highlighted with accent color
- Default to first token selected on load

### Right Column: Token Editor

**When a token is selected, show:**

1. **Token name** (large, bold heading)
2. **Description** (smaller text explaining purpose)
3. **Control** (context-appropriate input):
   - Color tokens: Color picker + hex input side-by-side
   - Size/spacing tokens: Text input with unit suffix
   - Shadow tokens: Text input (CSS value)
4. **Live value preview** where applicable:
   - Color tokens: Show color swatch
   - Typography: Example text rendered
   - Border radius: Preview box with border
   - Shadow: Preview box with shadow
5. **Status indicators**:
   - "Unsaved changes" badge when modified
   - "Default value" note if unmodified
6. **Quick actions**:
   - "Revert to default" button (just for this token)

**When nothing is selected:**
- Show empty state: "Select a token to edit"

### Bottom Actions Bar

Fixed bar at bottom with:
- **Save Draft** button (primary style, saves to DB)
- **Deploy to Staging** button (secondary/dark style, triggers Railway deploy)
- Status messages appear above buttons:
  - Success: "Saved successfully" with green background
  - Deployment: "Deployed to staging. May take 1-2 minutes." with link
  - Error: Red background with error message

### Visual Design Details

**Token List styling:**
- Group headers: 11px, uppercase, medium gray, bold, letter-spaced
- Token items: 13px, padding 10px 16px, hover state
- Selected: accent background (#FF00AE) with white text
- Unselected: light gray background (#F5F5F5), dark text
- Unsaved indicator: Small orange dot or text "(draft)"

**Editor area:**
- Title: 20px, bold, dark
- Description: 13px, gray (#888), line height 1.5
- Form inputs: 14px, padding 8-12px, rounded corners
- Color picker: 50px square, paired with hex input
- Preview elements: Subtle border, light gray background

**Action bar:**
- Fixed height: 72px
- Border top: 1px solid #EEE
- Buttons: Full height, generous padding, clear hierarchy
- Status messages: Slide in from top of action bar

## All Existing Settings to Include

From the codebase analysis:

**Design Tokens (14 total):**
1. Primary Accent Color (`primary_accent`) — Main brand color
2. Button Color (`button_color`) — Primary action buttons
3. Dark Background (`dark_background`) — Dark mode/overlays
4. Light Background (`light_background`) — Main light background
5. Secondary Background (`secondary_background`) — Subtle background
6. Card Background (`card_background`) — Cards and panels
7. Dark Text (`dark_text`) — Primary text color
8. Secondary Text (`secondary_text`) — Less prominent text
9. Border Radius (`border_radius`) — Corner rounding
10. Base Font Size (`base_font_size`) — Default text size
11. Bold Font Weight (`bold_font_weight`) — Bold text weight
12. Base Padding (`base_padding`) — Standard spacing
13. Card Shadow (`card_shadow`) — Drop shadow for cards
14. Max Content Width (`max_content_width`) — Content area width

**Note:** UI Copy and Prompts are in separate tabs and not part of this design.

## Open Questions

### Should the preview pane be eliminated entirely?

#### Context

The task description says "do not worry about the preview window," suggesting we should remove it and focus on the editing controls themselves.

#### Option: Remove Preview Pane (Recommended)

**Rationale:**
- Task explicitly says not to worry about preview
- Follows Prompts tab pattern (no preview there either)
- Simplifies UI and gives more space for editor
- Users can refresh main app in another tab to see changes
- Deploy to Staging provides real environment for testing
- Reduces complexity and maintenance

**Implementation:**
- Pure two-column layout: list + editor
- No live preview iframe or observation cards
- Individual token previews (color swatches, example text) sufficient

#### Option: Keep Lightweight Preview

**Rationale:**
- Visual feedback helps prevent mistakes
- Color changes especially benefit from preview
- Could show minimal preview (just color swatches, no full layout)

**Implementation:**
- Small preview area in right column below editor
- Just show color palette grid or single example card
- Not a full feed simulation

#### Recommendation

Remove preview pane, follow the Prompts tab pattern for consistency.

### Should we consolidate both design editor components?

#### Context

Currently two files exist: `SimplifiedDesignEditor.tsx` and `DesignSystemSection.tsx`.

#### Option: Use SimplifiedDesignEditor as Base

**Rationale:**
- Simpler, cleaner code
- No preview complexity
- Better matches the "two-column" requirement from task

**Implementation:**
- Refactor SimplifiedDesignEditor to match Prompts tab layout
- Remove DesignSystemSection from codebase
- Update AdminPanel to use improved SimplifiedDesignEditor

#### Option: Refactor DesignSystemSection

**Rationale:**
- Already integrated into AdminPanel
- Has preview infrastructure (if needed later)

**Implementation:**
- Remove preview pane code
- Restructure to two-column layout
- Keep SimplifiedDesignEditor for backwards compatibility

#### Recommendation

Consolidate into a single improved component based on SimplifiedDesignEditor pattern.

### How should token grouping work in the list?

#### Option: Collapsible Sections (Recommended)

**Rationale:**
- Clean organization by category
- Reduces cognitive load
- Mirrors design token structure (colors, typography, layout)
- Common pattern in design tools

**Implementation:**
- Three sections: Colors, Typography, Layout
- Each section collapsible with ▾/▸ icon
- Default to all sections expanded
- Maintain selection state when toggling

#### Option: Flat List with Visual Separators

**Rationale:**
- Simpler implementation
- All tokens always visible
- No interaction needed to access tokens

**Implementation:**
- Show all 14 tokens in single scrollable list
- Use headings/dividers to separate categories
- No collapse behavior

#### Recommendation

Collapsible sections for better organization.

### Should individual token changes auto-save or batch save?

#### Option: Batch Save (Recommended)

**Rationale:**
- Matches current implementation
- Allows experimentation without commitment
- Clear save/deploy workflow
- Prevents accidental changes

**Implementation:**
- Changes stay in component state until "Save Draft"
- Unsaved indicator shows which tokens changed
- Can revert individual tokens or all at once

#### Option: Auto-Save on Change

**Rationale:**
- Reduces friction
- No save button needed
- Immediate persistence

**Implementation:**
- Each field change triggers API call
- "Deploy to Staging" separate action
- Debounce to avoid excessive API calls

#### Recommendation

Batch save maintains control and matches existing pattern.

### Should the design tokens list show current values?

#### Option: Show Label Only (Recommended)

**Rationale:**
- Cleaner, less cluttered list
- Values visible in editor when selected
- Color tokens have visual indicator (swatch)

**Implementation:**
- List shows: "Primary Accent Color"
- Editor shows: value, picker, description

#### Option: Show Label + Value Preview

**Rationale:**
- More context at a glance
- Can compare values without clicking

**Implementation:**
- List shows: "Primary Accent Color" with small #FF00AE badge
- Colors show swatch, sizes show value

#### Recommendation

Label only for cleaner interface; editor provides full detail.

### What visual feedback for unsaved changes?

#### Option: Orange Dot Badge (Recommended)

**Rationale:**
- Subtle, doesn't clutter
- Standard pattern in many tools
- Clear signal without distraction

**Implementation:**
- Small orange dot next to modified token name in list
- "Unsaved changes" banner at top of editor
- Action bar shows count: "3 unsaved changes"

#### Option: Color Change in List Item

**Rationale:**
- More prominent visibility
- Impossible to miss

**Implementation:**
- Modified tokens show with orange/yellow background
- Or orange left border
- Bold text for modified items

#### Recommendation

Dot badge is cleaner and professional.

A designer or developer can:
1. Open Design Tokens tab and immediately see all 14 tokens organized clearly
2. Click any token and get a focused editor with description and appropriate control
3. Make multiple changes across tokens and see unsaved state clearly
4. Save draft to database or deploy directly to staging
5. Revert mistakes easily (per-token or all at once)
6. Complete a full design token update workflow in under 2 minutes

The interface should feel professional, intentional, and efficient — like a design tool you'd want to use, not a database admin panel.
