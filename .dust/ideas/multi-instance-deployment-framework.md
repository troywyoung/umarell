# Multi-Instance Deployment Framework

Enable creating multiple branded variants of the Umarell engine through an admin interface. Each instance (e.g., "Hot Takes" → "True Confessions") has its own subdirectory, isolated configuration, prompts, and UI experience while sharing the same codebase.

## Context

The current "Hot Takes" application demonstrates the core Umarell observation engine working well. The product architecture (6-layer research structure, thesis formatting, steel man generation) is general-purpose and could power different themed experiences beyond hot takes.

**Current state**: Single hardcoded "Hot Takes" instance with:
- Branding scattered throughout frontend (title, placeholders, copy in `app/src/App.tsx`)
- 13 configurable prompts in `api/prompts.py` (modifiable via admin API but not persisted)
- Comprehensive design token system in `api/design_tokens.py` (modifiable but not persisted)
- Basic admin panel (`app/src/AdminPanel.tsx`) for prompt/token editing
- No concept of "instances" in the data model
- No persistence layer for configuration changes (all in-memory)

**Vision**: Meta-admin interface where you can create "True Confessions", "Founder Diaries", "Product Predictions", etc. — each with custom branding, prompts, tone, and URL structure while running on the same deployment.

## What This Enables

1. **Rapid experimentation** — Spin up thematic variants without forking code
2. **A/B testing** — Compare different prompt strategies, tones, UX patterns
3. **Market exploration** — Test different audience segments (founders vs journalists vs academics)
4. **Product suite** — Build a family of focused observation tools under one roof
5. **White-label potential** — Future B2B opportunity for newsrooms, research teams

## Technical Architecture

### Database Schema Changes

Add three new models to `api/models.py`:

**Instance**
- `id` (primary key)
- `key` (unique slug, e.g., "hot-takes", "true-confessions") — used in URLs
- `display_name` (e.g., "Hot Takes", "True Confessions")
- `subdirectory` (e.g., "/hot-takes", "/confessions") — URL path
- `database_name` (e.g., "hot_takes.db") — isolated SQLite file per instance
- `created_at`, `updated_at`
- `is_active` (boolean, soft delete)

**InstanceConfig**
- `id` (primary key)
- `instance_id` (foreign key to Instance)
- `config_type` (enum: "branding", "prompts", "design_tokens", "ui_copy")
- `config_data` (JSON blob)
- `updated_at`

**InstancePrompt**
- `id` (primary key)
- `instance_id` (foreign key to Instance)
- `prompt_key` (e.g., "format_thesis", "generate_steel_man")
- `name`, `description`, `system`, `max_tokens`
- `is_default` (boolean) — falls back to system default if true
- `updated_at`

### Configuration Layers

Each instance needs customizable:

1. **UI Copy** (frontend strings)
   - Page title (currently hardcoded in `app/index.html`)
   - Placeholder text arrays (currently hardcoded in `App.tsx:15-56`)
   - CTA button text ("Drop a hot take" → "Share a confession")
   - Section headers, empty states, maintenance messages
   - Share text templates

2. **Prompts** (system instructions for LLM)
   - All 13 prompts from `api/prompts.py`
   - Instance can override defaults or inherit system defaults
   - Version tracking for prompt changes

3. **Design Tokens** (visual theming)
   - Colors (primary accent, backgrounds, confidence score colors)
   - Typography (fonts, sizes)
   - Spacing, borders, shadows, animations
   - Currently defined in `api/design_tokens.py`

4. **Branding Metadata**
   - Tagline ("A feed of hot takes — sharpened by AI")
   - Product description
   - Social share metadata (og:image, og:description)
   - Favicon/logo URLs

### Frontend Changes

**New endpoint**: `GET /instance/{instance_key}/config`
Returns merged configuration object:
```json
{
  "instance": {
    "key": "true-confessions",
    "display_name": "True Confessions",
    "subdirectory": "/confessions"
  },
  "ui_copy": {
    "page_title": "True Confessions",
    "placeholder_prompts": ["Your most vulnerable truth...", ...],
    "cta_button": "Share a confession",
    "section_header": "Confession"
  },
  "design_tokens": { ... },
  "branding": { ... }
}
```

**App initialization**:
- Extract instance key from URL path (`/confessions/...` → "true-confessions")
- Fetch config via `GET /instance/{key}/config`
- Inject config into React context
- Replace all hardcoded strings with config values

**Config-driven rendering**:
- Move hardcoded placeholders to state derived from config
- Make button labels, titles, headers dynamic
- Apply design tokens via CSS-in-JS or CSS custom properties

### Backend Changes

**Persistence layer**:
- Create SQLAlchemy models for Instance, InstanceConfig, InstancePrompt
- Migrate current in-memory prompt/token modifications to database
- Add `GET /instance/{key}/config` endpoint (merges defaults + overrides)
- Update `PUT /admin/prompts/{key}` to save to database instead of memory
- Update `PUT /admin/design-tokens` to save to database

**Multi-database routing**:
- Current: Single SQLite at `/app/data/umarell.db`
- Proposed: Per-instance SQLite files (`/app/data/instances/hot_takes.db`)
- Add middleware to determine instance from request path
- Set database session to correct instance DB before processing

**Admin API expansion**:
- `GET /admin/instances` — List all instances
- `POST /admin/instances` — Create new instance
- `PUT /admin/instances/{key}` — Update instance config
- `DELETE /admin/instances/{key}` — Soft delete (set is_active=false)
- `GET /admin/instances/{key}/prompts` — Get instance-specific prompts
- `PUT /admin/instances/{key}/prompts/{prompt_key}` — Override prompt for instance

### Admin Interface

**New route**: `/admin/instances` (meta-admin)

Features:
- List all instances (cards with name, URL, creation date, active users)
- "Create New Instance" button → wizard:
  1. Basic info (key, display name, subdirectory)
  2. Clone from existing or start fresh
  3. Customize UI copy (form with all text fields)
  4. Customize design tokens (color pickers, font selectors)
  5. Customize prompts (text areas for each system prompt)
  6. Preview (render sample observation with config)
  7. Deploy (creates instance, provisions database)
- Edit existing instances (same wizard, pre-populated)
- Toggle active/inactive
- View usage metrics (observations created, active users)

**Existing admin panel** (`/admin/prompts`, `/admin/design-tokens`):
- Becomes instance-scoped
- Dropdown to select which instance you're editing
- Shows which values are inherited vs overridden

### Deployment Model

**Option A: Subdirectory routing (simpler)**
- Single Railway deployment
- All instances served from same domain
- URL structure: `umarell.app/hot-takes/...`, `umarell.app/confessions/...`
- Frontend router matches path prefix to load instance config
- Backend middleware extracts instance from path

**Option B: Subdomain routing (cleaner URLs)**
- `hot-takes.umarell.app`, `confessions.umarell.app`
- Requires wildcard DNS and SSL certificate
- Frontend/backend determine instance from subdomain
- More complex but better user experience

**Option C: Multi-deployment (most isolated)**
- Each instance is a separate Railway project
- Completely isolated databases, environments
- Meta-admin creates new Railway projects via API
- Most complex, but strongest isolation

## Example: Creating "True Confessions"

Admin opens `/admin/instances` and clicks "Create New Instance":

1. **Basic Info**
   - Key: `true-confessions`
   - Display Name: `True Confessions`
   - Subdirectory: `/confessions`

2. **UI Copy Customization**
   - Page title: `True Confessions`
   - Placeholder prompts:
     - "Your most vulnerable truth..."
     - "The thing you've never said out loud..."
     - "What you're afraid to admit..."
   - CTA button: `Share a confession`
   - Section header: `Confession`
   - Empty state: `Share your first confession`
   - Feed description: `A space for honesty — validated by AI, anonymous if you choose.`

3. **Design Tokens**
   - Primary accent: `#6B46C1` (purple instead of hot pink)
   - Dark background: `#1A1625` (deep purple-black)
   - Confidence colors:
     - "Deeply honest" (instead of "Undeniable")
     - "Rings true" (instead of "Holds water")
     - etc.

4. **Prompt Overrides**
   - `format_thesis`: Change tone from "punchy debate thesis" to "vulnerable but clear confession"
   - `generate_steel_man`: Rename to "Empathy Layer" — validate the emotion behind confession
   - `generate_counterpoint`: Soften tone — challenge gently instead of aggressively
   - `call_bullshit`: Remove entirely (confessions aren't about credibility scoring)

5. **Preview & Deploy**
   - System generates preview with sample confession
   - Admin approves
   - Backend creates `true_confessions.db`, writes config to database
   - Instance goes live at `/confessions` or `confessions.umarell.app`

## Migration Path

**Phase 1: Persistence layer**
- Add Instance, InstanceConfig, InstancePrompt models
- Create default "hot-takes" instance from current hardcoded config
- Migrate prompt/token updates to save to database
- Update admin panel to read from database

**Phase 2: Config-driven frontend**
- Add instance config fetch on app load
- Replace hardcoded strings with config values
- Test with existing hot-takes instance (should be unchanged)

**Phase 3: Multi-instance routing**
- Add subdirectory/subdomain routing logic
- Implement database-per-instance or multi-tenant schema
- Update API to scope requests to instance

**Phase 4: Admin interface**
- Build instance creation wizard
- Add instance management UI
- Enable cloning and customization

**Phase 5: Production rollout**
- Launch "True Confessions" as second instance
- Validate isolation and configuration
- Iterate based on learnings

## Codebase Touchpoints

Files that need modification:

**Backend**:
- `api/models.py` — Add Instance, InstanceConfig, InstancePrompt models
- `api/prompts.py` — Refactor to load from database instead of module constant
- `api/design_tokens.py` — Same as above
- `api/main.py` — Add instance routing middleware, new admin endpoints
- `api/database.py` — Add multi-database session management

**Frontend**:
- `app/index.html` — Make title dynamic
- `app/src/App.tsx` — Replace hardcoded strings with config-driven values
- `app/src/config.ts` — Add instance config fetching logic
- `app/src/AdminPanel.tsx` — Add instance management tab
- `app/src/contexts/InstanceContext.tsx` — New context for instance config

**Infrastructure**:
- `docker-compose.yml` — May need updates for multi-instance local dev
- `.env.example` — Document instance-related env vars
- Railway config — Subdomain routing or path-based routing setup

## Related Ideas

- **Instance analytics dashboard** — Compare performance across instances (conversion, engagement, thesis quality)
- **Prompt marketplace** — Share and discover effective prompt strategies across instances
- **Instance templates** — Pre-built configs for common use cases ("Contrarian Corner", "Founder Confessions", etc.)
- **Cross-instance features** — "Challenge this take in True Confessions" (move observation across instances)
- **API for programmatic instance creation** — For advanced users or external tools

## Success Metrics

This idea would be successful if:
- New instance can be created in under 10 minutes via admin UI
- Each instance feels like a distinct product (not just reskinned)
- Instances share 95%+ of codebase (no forking required)
- Zero cross-instance data leakage
- Admin can A/B test prompt strategies across instances
- At least 3 viable instance concepts validated (beyond Hot Takes)

## Open Questions

### What is the URL structure for instances?

#### Option: Subdirectory-based (e.g., `/hot-takes`, `/confessions`)

**Pros**:
- Single domain, single SSL certificate
- Simpler deployment (no DNS/wildcard cert setup)
- Easier local development
- Instance switching via nav is trivial

**Cons**:
- Longer URLs (`umarell.app/confessions/observation/123`)
- Feels like "sections" not "products"
- SEO may treat as subsections of main site

**Implementation**:
- Frontend router: Check `window.location.pathname.split('/')[1]` for instance key
- Backend: Extract from request path before routing

#### Option: Subdomain-based (e.g., `confessions.umarell.app`)

**Pros**:
- Cleaner URLs
- Each instance feels like standalone product
- Better SEO separation
- Potential for custom domain mapping later

**Cons**:
- Requires wildcard DNS (`*.umarell.app`)
- Requires wildcard SSL certificate
- More complex local development (need `/etc/hosts` or DNS tricks)
- Cross-instance navigation requires full page reload

**Implementation**:
- Frontend: Extract subdomain from `window.location.hostname.split('.')[0]`
- Backend: Read `Host` header to determine instance

#### Option: Hybrid (subdirectory for staging, subdomain for production)

Use subdirectory-based routing for local/staging to keep development simple, then migrate to subdomains in production for brand clarity.

### How should databases be isolated?

#### Option: Single shared database with `instance_id` foreign key (multi-tenant)

**Pros**:
- Single database file to manage
- Easier to query across instances (e.g., admin analytics)
- Simpler backup/restore
- Fewer database connections

**Cons**:
- Risk of data leakage if queries forget `instance_id` filter
- All instances share same database performance characteristics
- Harder to scale instances independently
- More complex queries (always filtering by instance)

**Implementation**:
- Add `instance_id` to `Observation`, `User` models
- Add SQLAlchemy query filter middleware
- Require `instance_id` in all query scopes

#### Option: Separate SQLite file per instance

**Pros**:
- Strong data isolation (impossible to leak across instances)
- Each instance can be backed up/restored independently
- Easy to migrate instance to separate deployment later
- Simpler queries (no instance_id filtering needed)

**Cons**:
- More database files to manage (`/app/data/instances/hot_takes.db`, etc.)
- Cross-instance analytics require multiple DB connections
- More complex connection pooling

**Implementation**:
- Store database filename in Instance model
- Create new SQLite file on instance creation
- Middleware sets database session based on request instance
- Admin analytics connect to all instance DBs in sequence

#### Option: PostgreSQL with schema-per-instance

If migrating from SQLite to PostgreSQL (recommended for production), use PostgreSQL schemas as instance boundary:
- `hot_takes.observations`, `confessions.observations`, etc.
- Strong isolation within single database
- Better query performance than SQLite
- Easier cross-instance analytics than separate files

### What configuration can instances override vs inherit?

#### Option: Full override (instance can change anything)

Every prompt, design token, UI string is customizable per instance. If not overridden, falls back to system default.

**Pros**:
- Maximum flexibility
- True product differentiation
- Can create radically different experiences

**Cons**:
- Easy to break UX consistency
- Admin interface becomes overwhelming
- Hard to enforce quality standards
- System-wide improvements don't propagate automatically

#### Option: Constrained override (only specific fields are customizable)

Define explicit "customization points" (e.g., colors, page title, 5 key prompts). Everything else is system-controlled.

**Pros**:
- Maintains UX coherence
- Simpler admin interface
- System improvements propagate to all instances
- Faster instance creation

**Cons**:
- Less flexibility
- May hit edge cases where override is needed but not allowed
- Requires careful design of what's customizable

#### Option: Tiered override (basic vs advanced customization)

Two levels:
- **Basic tier**: 10 high-level knobs (colors, title, tagline, tone slider)
- **Advanced tier**: Full prompt editing, granular token control

Default to basic tier; advanced requires explicit unlock.

**Pros**:
- Progressive disclosure (simple by default, powerful when needed)
- Protects against accidental breakage
- Serves both "spin up quick variant" and "deep customization" use cases

**Cons**:
- More complex permission/UI model
- Requires defining what belongs in each tier

### Should instances share user accounts or be isolated?

#### Option: Shared user accounts (one login across all instances)

User signs in once, can participate in any instance. `Observation` model has `instance_id`, `User` model does not.

**Pros**:
- Single identity across products
- User can explore multiple instances without re-auth
- Shared profile, saved observations across instances
- Simpler auth implementation

**Cons**:
- User's activity is trackable across instances (privacy concern)
- Less clear product separation
- May confuse users ("why is my confession showing in hot takes?")

**Implementation**:
- Keep existing `User` model as-is
- Add `instance_id` to `Observation` only
- Filter observations by instance in queries

#### Option: Isolated users per instance

Each instance has its own user database. Signing into "Hot Takes" is separate from "True Confessions".

**Pros**:
- Strong privacy boundary (confessions are separate from hot takes)
- Clearer product identity
- User experience is instance-specific

**Cons**:
- Must re-authenticate for each instance
- Duplicated user records if same person uses multiple instances
- More complex if we want cross-instance features later

**Implementation**:
- If using separate DBs per instance, User table lives in instance DB
- If using shared DB, add `instance_id` to `User` model
- Auth scopes tokens to instance

#### Option: Shared accounts with instance-specific profiles

Users have one login but separate "personas" per instance. E.g., same email, but different display name/avatar/bio in Hot Takes vs Confessions.

**Pros**:
- Single auth but contextual identity
- Privacy protection (can be anonymous in one, public in another)
- Best of both worlds

**Cons**:
- Most complex to implement
- Requires `UserInstanceProfile` join table
- Confusing UX if not designed carefully

### How does the admin interface handle instance selection?

#### Option: Global admin panel with instance dropdown

Single `/admin` route. Top of page has dropdown to select which instance you're managing. All edits scoped to selected instance.

**Pros**:
- Simple navigation (one admin URL)
- Easy to switch between instances
- Familiar pattern (like switching organizations in SaaS apps)

**Cons**:
- Risk of editing wrong instance (selected wrong one in dropdown)
- Harder to compare configs across instances
- Less clear visual separation

#### Option: Instance-scoped admin routes

Each instance has its own admin: `/hot-takes/admin`, `/confessions/admin`. Meta-admin at `/admin` lists instances.

**Pros**:
- Clear context (URL shows which instance you're editing)
- Can't accidentally edit wrong instance
- Easier to bookmark/share admin URLs

**Cons**:
- Switching instances requires navigation
- Duplication of admin UI code (or complex routing)

#### Option: Split UI (instance list + detail view)

Left sidebar shows all instances as list. Clicking one loads its config in right panel. "Create New Instance" button at top.

**Pros**:
- Good for managing many instances
- Easy to compare and switch
- Overview + detail pattern is intuitive

**Cons**:
- Requires more screen space (not mobile-friendly)
- More complex UI implementation

### What happens to existing "Hot Takes" during migration?

#### Option: Migrate in place (Hot Takes becomes first instance)

Create "hot-takes" instance record with current config. Existing observations stay in database, get `instance_id = hot-takes` backfilled.

**Pros**:
- No data loss
- Seamless transition for existing users
- Maintains URL compatibility if using subdirectory model (`/hot-takes`)

**Cons**:
- Migration script must be perfect (risky)
- URL changes if moving from root to subdirectory

#### Option: Freeze current, launch fresh

Leave current hot-takes deployment as-is. Launch new multi-instance system as separate deployment. Gradually migrate users.

**Pros**:
- Zero risk to existing system
- Can test thoroughly before migration
- Fallback is easy

**Cons**:
- Duplication of infrastructure during transition
- Must maintain two systems temporarily
- Users split across old and new

### Should instance creation be self-service or gated?

#### Option: Admin-only (must be admin_email to create instances)

Instance creation requires authentication and admin role.

**Pros**:
- Quality control
- Prevents abuse/spam instances
- Aligns with current PIMP-style prototype model

**Cons**:
- Slows experimentation
- Requires manual provisioning

#### Option: Self-service with approval

Anyone can create instance, but it's in "draft" state until admin approves and activates.

**Pros**:
- Lowers barrier to experimentation
- Crowdsources ideas for new instances
- Admin retains veto power

**Cons**:
- More complex workflow
- May create approval backlog

#### Option: Fully self-service (future B2B model)

Anyone can create instance, becomes owner, can invite team, etc. Potential paid feature.

**Pros**:
- Enables B2B/white-label use case
- True product suite model
- Revenue opportunity

**Cons**:
- Requires billing, team management, permissions
- Much larger scope
- Security/moderation concerns
