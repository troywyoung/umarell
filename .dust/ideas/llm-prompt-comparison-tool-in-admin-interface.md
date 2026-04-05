# LLM Prompt Comparison Tool in Admin Interface

Enable rapid iteration on LLM prompts by providing side-by-side comparison of saved vs draft prompt outputs against test queries. The admin interface should allow editing meta prompts, then immediately running both versions against a test query to preview impact before committing changes.

## Why

Prompt engineering is iterative and requires fast feedback. Without a comparison tool, the workflow is:
1. Edit prompt in admin interface
2. Save changes (triggers database update)
3. Manually test the system with sample inputs
4. Observe results
5. If unsatisfactory, revert or edit again

This creates friction and risk. Each save is a commitment without preview. A comparison tool enables:
- **Rapid iteration**: Test before committing
- **Risk reduction**: See changes before they affect users
- **Quality validation**: Compare outputs side-by-side to catch regressions
- **Experimentation**: Try radical changes without fear

## Current Implementation

**Status: Shipped** (commit c7a8d8a)

The prompt comparison tool is fully implemented:

### Frontend (AdminPanel.tsx:276-366)
- Test comparison UI appears when prompt has unsaved changes
- Textarea for test query input (lines 284-297)
- "Run Comparison" button triggers comparison (lines 298-314)
- Two-column results display (lines 318-366):
  - Left: Saved prompt output (green border)
  - Right: Draft prompt output (magenta border)
  - Monospace font, scrollable, max 300px height

### Backend API Endpoint (main.py:1205-1247)
**Route**: `POST /admin/prompts/compare`

**Request Schema**:
```python
class PromptComparisonRequest(BaseModel):
    saved_prompt_key: str      # e.g., "format_thesis"
    draft_system: str          # New system prompt to test
    draft_max_tokens: int      # New max_tokens value
    test_query: str            # User input to run both prompts against
```

**Response**:
```json
{
  "test_query": "...",
  "saved": {
    "name": "...",
    "system": "...",
    "max_tokens": 2000,
    "output": "LLM response from saved prompt..."
  },
  "draft": {
    "system": "...",
    "max_tokens": 2000,
    "output": "LLM response from draft prompt..."
  }
}
```

**Process**:
1. Fetches saved prompt by key from database
2. Calls `pipeline._call()` with saved prompt + test query
3. Calls `pipeline._call()` with draft prompt + test query
4. Returns both outputs for side-by-side comparison

**Key Behaviors**:
- Admin-only (requires `_is_admin()` check)
- Ephemeral (no persistence)
- Uses production LLM provider (Gemini or Anthropic via pipeline.py)
- Real-time execution (not cached)

### Prompt Management Context

**All Prompts** (prompts.py:13-236):
1. `extract_from_image` - Extract thesis from photos/screenshots
2. `format_thesis` - Convert raw input to 1-2 sentence thesis
3. `format_challenge_thesis` - Convert counter-argument to opposing thesis
4. `generate_steel_man` - Build strongest case FOR a thesis
5. `generate_steel_man_challenge` - Build strongest case against original claim
6. `generate_metadata` - Score conviction (0-100), assign tags, evidence type
7. `judge_strength` - Rate counterpoint strength
8. `generate_counterpoint` - Generate aggressive case AGAINST thesis
9. `generate_pva_take` - Generate PvA podcast-voice reaction
10. `call_bullshit` - Credibility check (BS score 0-100)
11. `generate_joke` - Brian Morrissey one-liner response
12. `negate_thesis` - Return logical opposite of thesis
13. `extract_podcast_takes` - Extract interesting claims from podcast transcripts

**Prompt Storage**:
- Database: `InstancePrompt` table (models.py:97-108)
- Per-instance overrides (e.g., "hot-takes" instance)
- Fallback to module defaults from `prompts.py`

## Desired Behavior

Current implementation delivers the core requirement: side-by-side comparison before saving. Potential enhancements:

### Test Query Library
Current: Ad-hoc test queries entered each time
Potential: Save frequently-used test queries for reuse
- Quick access to standard test cases
- Benchmark queries for consistency testing
- Instance-specific test query sets

### Batch Comparison
Current: Single test query at a time
Potential: Run multiple test queries in one comparison
- Test edge cases simultaneously
- Generate comparison report across multiple inputs
- Export comparison results as report

### Comparison History
Current: Ephemeral results (cleared when modal closes)
Potential: Persist comparison history
- Review past comparisons when iterating
- Compare multiple draft versions before choosing one
- Track prompt evolution over time

### Diff Visualization
Current: Full output side-by-side
Potential: Highlight changes between outputs
- Character-level or word-level diff
- Emphasize what changed, not just what's different
- Easier to spot subtle regressions

### Performance Metrics
Current: Only shows output text
Potential: Include token count, latency, cost
- Track prompt efficiency (tokens used)
- Compare response time
- Calculate cost differential

## Open Questions

### Should test queries be saved and reusable?

#### Option: Keep ephemeral
Current behavior — enter query each time. Simpler implementation, no additional database schema.

#### Option: Save to instance
Store test queries per instance in database. Requires new table (`InstanceTestQuery`) and UI for managing saved queries. More convenient for repeated testing but adds complexity.

#### Option: Save to prompt
Associate test queries with specific prompts. Most targeted but couples test data to prompt configuration.

### Should comparison results be persisted?

#### Option: Keep ephemeral
Current behavior — results disappear when modal closes. Simpler, no storage required.

#### Option: Save comparison history
Store comparison results with timestamp, prompt versions, query, and outputs. Enables review of past iterations. Requires new table and significant storage (LLM outputs can be large).

#### Option: Export on demand
Provide "Export Comparison" button to save as JSON or markdown. User controls what to keep. Middle ground between ephemeral and full persistence.

### Should batch comparison be supported?

#### Option: Single query only
Current behavior — one test query at a time. Simple, focused feedback.

#### Option: Multiple queries in sequence
Allow entering multiple test queries, run each against both prompts, display all results. Better for comprehensive testing but more complex UI.

#### Option: Saved test suites
Define test suites (collections of queries) that can be run in one click. Most powerful but requires significant additional implementation.

### Should the comparison show performance metrics?

#### Option: Output only
Current behavior — only show LLM response text. Clean, focused on content quality.

#### Option: Include token count and latency
Display tokens used and response time for each call. Helpful for optimizing prompt efficiency. Requires tracking in `pipeline._call()`.

#### Option: Include cost estimate
Calculate approximate API cost based on tokens and model. Most complete but requires maintaining pricing data.

### Should there be a diff view in addition to side-by-side?

#### Option: Side-by-side only
Current behavior — full outputs in two columns. Easy to scan and compare manually.

#### Option: Unified diff view
Show changes inline with additions/deletions highlighted. Easier to spot small differences but harder to read full outputs.

#### Option: Toggle between views
Offer both side-by-side and diff modes. Most flexible but more complex UI.

### How should the tool handle slow or failed LLM calls?

#### Option: Show loading spinner
Current behavior — button says "Running..." during comparison. Simple but no visibility into which call is slow.

#### Option: Progressive loading
Show saved output immediately when ready, then draft output when ready. Faster perceived performance.

#### Option: Timeout and error handling
Add explicit timeout (e.g., 30s) and show error message if call fails. More robust but requires additional error UI.

### Should the comparison tool work for prompts that require additional context?

#### Option: Test query only
Current behavior — only accepts text query. Works for most prompts but can't test prompts that need images, URLs, or structured data.

#### Option: Support additional inputs
Add optional fields for image URL, structured data, etc. More comprehensive but significantly more complex.

#### Option: Use recent production data
Provide option to select a recent observation and use its actual input. Most realistic but requires production data access.
