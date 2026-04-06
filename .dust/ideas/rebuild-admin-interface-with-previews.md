# Rebuild admin interface with previews

The current admin interface exists but doesn't function properly. It lacks real-time preview capabilities, making it difficult to confidently iterate on design tokens and prompts without deploying to staging first.

## Problem

The existing admin interface (AdminPanel.tsx, 1,210 lines) doesn't function properly. It has the right components but the user experience is broken. The current implementation allows editing design tokens and prompts, but lacks real-time preview capabilities that let you see changes before committing to staging.

## What exists today

**Admin panel structure:**
- Tab-based UI with 4 sections: Instances, LLM Prompts, Design Tokens, Podcast Ingest
- Located in `app/src/AdminPanel.tsx` (1,210 lines, complex)
- Backend endpoints in `api/main.py` (28 admin routes)

**Design system controls:**
- Full token system: 7 categories (colors, typography, spacing, borders, shadows, layout, animations)
- Simplified token system: 14 high-leverage controls (primary color, backgrounds, font size, etc.)
- Tokens stored per-instance in `instance_configs` table
- Editor component: `app/src/admin/SimplifiedDesignEditor.tsx`

**Prompt management:**
- 13 defined prompts (format_thesis, generate_steel_man, generate_counterpoint, etc.)
- Prompts stored in `instance_prompts` table with per-instance overrides
- Test suite system for batch prompt comparison
- Side-by-side comparison UI (saved vs draft)

**Current workflow issues:**
1. No real-time preview — must save changes and deploy to staging to see results
2. Design editor shows token values but no visual representation of how they affect UI
3. Prompt comparison shows text output but no structured validation or visual impact
4. No preview window showing sample outputs when changing prompts or models
5. Multi-step friction: edit → save → push to staging → manual verification

## What should be built (step by step)

### Step 1: Simplified admin interface architecture

Scrap the existing 1,210-line AdminPanel.tsx. Build a new admin interface from scratch with these principles:
- **Simple and intuitive controls** — fewer clicks, clearer visual hierarchy
- **Preview-first workflow** — see changes before committing
- **Two main sections** (not four):
  1. Design System
  2. Prompt Structure and LLM

### Step 2: Design system section

**Controls:**
- Use the existing 14 simplified tokens as the control surface
- Visual controls: color pickers, sliders for spacing/sizing, dropdowns for fonts
- Live preview pane showing actual UI components with applied tokens
- Compare mode: current production vs. draft side-by-side

**Preview:**
- Render actual Umarell components in an iframe with draft tokens applied
- Show key screens: observation input, thesis display, steel man output, counterpoint view
- Toggle between light/dark if applicable
- Instant visual feedback as tokens change

**Commit workflow:**
- Save draft locally (persists in database)
- "Push to Staging" button triggers deployment
- Link to staging instance for manual verification
- "Promote to Production" button (separate approval step)

### Step 3: Prompt structure and LLM section

**Controls:**
- List of all 13 prompts with expandable editor for each
- Show: prompt name, description, system prompt text, max_tokens, LLM provider
- Edit fields: system prompt, max_tokens, model selection (Gemini vs Anthropic)
- Add ability to edit user prompt template (currently hardcoded in pipeline.py)

**Preview window:**
- Select a test query (from existing test suites or enter custom)
- "Run Preview" button executes prompt with draft changes
- Shows structured output: generated text, token count, latency, cost estimate
- Side-by-side comparison: saved prompt output vs. draft prompt output
- Highlight differences in output (text diff with color coding)

**Testing:**
- Select existing test suite or create new one
- Run batch comparison (saved vs draft) across all queries in suite
- Show results table: query | saved output | draft output | difference score
- Aggregate metrics: avg token count, avg latency, avg quality score (if measurable)

**Commit workflow:**
- Same as design system: save draft → push to staging → verify → promote to production

## Benefits

1. **Confidence** — see impact before deploying, reducing risk of breaking changes
2. **Speed** — faster iteration with real-time visual feedback
3. **Clarity** — simpler interface reduces cognitive load for admins
4. **Quality** — side-by-side comparisons make it obvious when changes improve or degrade output
5. **Traceability** — clear workflow from draft → staging → production

## Technical approach

**Frontend:**
- New component: `app/src/admin/AdminV2.tsx` (replaces AdminPanel.tsx)
- Sub-components:
  - `DesignSystemEditor.tsx` — token controls + preview iframe
  - `PromptEditor.tsx` — prompt editing + test execution + diff view
- Preview rendering:
  - Iframe or shadow DOM to isolate token application
  - Pass draft tokens as props to rendered components
  - Use existing observation/thesis components for preview content

**Backend:**
- Keep existing admin endpoints (28 routes)
- Add new endpoint: `POST /admin/prompts/preview` for single draft prompt execution
- Add new endpoint: `POST /admin/deploy-to-staging` to trigger Railway staging deployment
- Consider adding: `POST /admin/promote-to-production` for production promotion

**Database:**
- Reuse existing `instance_configs` and `instance_prompts` tables
- Add draft flag or separate draft tables if needed for staging workflow

## Related context

**Files to scrap (or heavily refactor):**
- `app/src/AdminPanel.tsx` (1,210 lines) — current admin interface
- `app/src/admin/SimplifiedDesignEditor.tsx` — current design editor (may be salvageable)

**Files to keep:**
- `api/main.py` — admin endpoints (28 routes)
- `api/design_tokens.py` — token definitions (252 lines)
- `api/simplified_tokens.py` — simplified token mappings (131 lines)
- `api/prompts.py` — prompt definitions (358 lines)

**Dependencies:**
- Existing admin endpoints in API (no changes needed initially)
- Existing database tables: `instance_configs`, `instance_prompts`
- Existing authentication: JWT token + `admin_email` role check

**References:**
- CLAUDE.md — product concept and design principles
- `.dust/facts/system-input-output-flow.md` — current pipeline architecture
- `.dust/facts/staging-review-workflow.md` — deployment process

## Open Questions

### How should preview content be populated?

#### Option 1: Use real production observations
Load recent observations from the database and render them with draft tokens. Shows realistic content but may expose sensitive data in preview.

#### Option 2: Use synthetic test data
Create fake observations with representative content. Safer for privacy but may not catch edge cases.

#### Option 3: Hybrid approach (Recommended)
Use anonymized production data (thesis text only, no user info) with fallback to synthetic data if no recent observations exist.

### Should design token changes apply globally or per-instance?

#### Option 1: Global design system
All instances share the same design tokens. Simpler to manage but less flexible.

#### Option 2: Per-instance customization
Each instance can have unique design tokens (current implementation). More complex but supports white-label use cases.

#### Option 3: Global defaults with instance overrides (Recommended)
Default tokens apply to all instances unless explicitly overridden. Balances flexibility and simplicity.

### How should prompt changes be versioned?

#### Option 1: Simple draft/production toggle
Each prompt has a draft version and a production version. Deploying replaces production with draft. Simple but no rollback history.

#### Option 2: Full version history
Store all prompt versions with timestamps. Can rollback to any previous version. More complex but safer.

#### Option 3: Git-backed prompt storage (Recommended)
Store prompts in version-controlled files (e.g., `api/prompts.py`). Deployment commits changes. Leverages existing Git workflow for rollback and audit trail.

### Should the admin interface be a separate app or embedded in the main app?

#### Option 1: Embedded in main app (current implementation)
Admin panel accessible via button in main UI. Simple deployment but increases bundle size.

#### Option 2: Separate admin app
Standalone admin interface at `/admin` route or separate subdomain. Cleaner separation but requires separate deployment.

#### Option 3: Lazy-loaded admin route (Recommended)
Admin interface code-split and lazy-loaded only when accessed. Best of both worlds: single deployment, no bundle bloat.

### How should staging deployment be triggered?

#### Option 1: Manual deployment via Railway dashboard
Admin saves changes, then manually deploys via Railway UI. Simple but requires context switching.

#### Option 2: Automated deployment via API
Admin clicks "Push to Staging" button, which triggers Railway deployment via API. Seamless but requires Railway API integration.

#### Option 3: Git-based deployment (Recommended)
Admin clicks "Push to Staging", which commits changes to a `staging` branch and triggers Railway auto-deploy. Leverages existing CI/CD and provides audit trail.

### How should prompt output quality be measured in comparisons?

#### Option 1: Human evaluation only
Admin reviews saved vs. draft outputs manually. Simple but subjective and time-consuming.

#### Option 2: Automated quality scoring
Use an LLM judge to score output quality (relevance, clarity, accuracy). Fast but may introduce bias.

#### Option 3: Test suite with expected outputs (Recommended)
Define test queries with expected output characteristics. Compare draft outputs against saved outputs and flag significant deviations. Balances automation and human judgment.
