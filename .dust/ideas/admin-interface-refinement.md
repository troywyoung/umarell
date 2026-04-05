# Admin interface refinement

Simplify the design token editor to enable rapid visual customization with under 15 variables and clear save state feedback. The current simplified design editor (SimplifiedDesignEditor.tsx:15-358) already implements 14 high-leverage tokens, but needs improved UX clarity around save state and deployment workflow.

## Why

The design tab currently works but lacks clear affordances. Users need to know when changes are saved, what happens when they save, and how to revert mistakes. The system should communicate state clearly and make the deployment workflow transparent.

## Current Implementation

The simplified token system already exists:
- 14 high-leverage tokens in simplified_tokens.py:10-25 (colors, typography, spacing, layout)
- Mapping to full design token structure (simplified_tokens.py:28-43)
- Save endpoint triggers staging deployment (main.py:1241-1294)
- Revert to defaults endpoint (main.py:1297-1337)
- Railway staging deployment via git merge (main.py:1347-1420)

The SimplifiedDesignEditor component (SimplifiedDesignEditor.tsx) provides:
- Modal design token editor
- Color picker for color tokens
- Text inputs for all tokens
- Save button that triggers deployment
- Revert to defaults button
- Success feedback with deployment notification

## Desired behavior

### Clearer save state communication
- Show unsaved changes indicator when tokens differ from saved state
- Visual confirmation when save completes
- Show deployment status (triggered, in progress, complete)
- Distinguish between "saved to database" and "deployed to staging"

### Simplified token control structure
- Current 14 tokens are already well-chosen
- Consider grouping into sections (Colors, Typography, Layout)
- Visual preview of changes before saving (difficult without full app reload)

### Automatic staging deployment
- Already implemented via trigger_staging_deployment()
- Could add deployment status polling
- Could notify when staging deployment completes

## Open Questions

### Should the design tab show a live preview of token changes?

#### Option: No live preview
Current behavior — change tokens, save, view in staging environment. Simpler implementation, clear separation between editing and deployment.

#### Option: CSS variable injection preview
Inject CSS variables into the admin panel itself to show immediate effect. Would require admin panel to use the same design token system as the main app. More complex but provides instant feedback.

#### Option: Iframe preview
Show a preview of the main app in an iframe with injected token values. Most realistic but adds significant complexity and may have CORS/authentication issues.

### How should save state be communicated?

#### Option: Button state only
Current behavior — button text changes to "Saving..." and shows green success banner. Simple and clear.

#### Option: Persistent indicator
Add a persistent "Unsaved changes" badge or status indicator separate from the button. More visible but adds visual noise.

#### Option: Comparison view
Show a diff between current values and saved values. Most informative but takes significant screen space.

### Should deployment status be tracked and displayed?

#### Option: Fire and forget
Current behavior — trigger deployment, show confirmation, done. Simple but provides no feedback about deployment success/failure.

#### Option: Polling for deployment status
Poll Railway API to track deployment progress and completion. Requires Railway API integration and adds complexity.

#### Option: Manual staging verification
After saving, show a link to the staging environment with instruction to verify changes. Low-tech but effective.

### Should there be a way to preview changes without deploying to staging?

#### Option: No preview deployment
Current behavior — all saves go to database and trigger staging deployment. Simple but makes experimentation costly.

#### Option: Save without deploy flag
Add a "Save Draft" vs "Save & Deploy" option. Allows iteration without triggering deployments. Requires UI changes and endpoint modification.

#### Option: Separate preview environment
Create a third environment (local or cloud) for token preview. Most flexible but significantly more infrastructure.

### How should the simplified token set be organized in the UI?

#### Option: Flat list
Current behavior — all 14 tokens in a 2-column grid. Simple but no semantic grouping.

#### Option: Grouped sections
Group tokens by category (Colors, Typography, Layout). Easier to scan and find specific token types.

#### Option: Tabbed sections
Separate groups into tabs or accordions. Reduces visual density but adds navigation overhead.

### Should the admin interface support per-instance token customization?

#### Option: Global tokens only
Current behavior — design tokens apply to the "hot-takes" instance. Simpler model, one design system.

#### Option: Per-instance tokens
Allow each instance to have custom design tokens. More flexible but significantly more complex to implement and manage. Would need instance selector in the design editor.
