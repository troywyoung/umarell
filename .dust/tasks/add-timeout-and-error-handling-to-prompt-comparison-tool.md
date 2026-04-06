# Add Timeout and Error Handling to Prompt Comparison Tool

Add explicit timeout (30 seconds) and error handling to the prompt comparison endpoint and UI. When an LLM call fails or times out, show a clear error message instead of hanging indefinitely or showing a generic error.

## Why

The current comparison tool (`POST /admin/prompts/compare`, implemented in main.py:1205-1247) has no explicit timeout or error handling. If an LLM call is slow or fails:
- The UI shows "Running..." indefinitely
- No visibility into which call (saved vs draft) is slow
- Generic error states don't help the user understand what went wrong

This violates the actionable-errors principle: error messages should tell you what to do next, not just what went wrong.

## Current Behavior

**Backend** (main.py:1205-1247):
- No timeout on `pipeline._call()` invocations
- No try/catch around LLM calls
- Errors bubble up as generic 500 responses

**Frontend** (AdminPanel.tsx:276-366):
- Button shows "Running..." during comparison
- No progressive loading (both results appear together or not at all)
- No specific error display for timeout vs failure

## Desired Behavior

**Backend**:
- Add 30-second timeout to each `pipeline._call()` invocation
- Wrap calls in try/catch with specific error messages:
  - "Saved prompt timed out after 30s"
  - "Draft prompt timed out after 30s"
  - "Saved prompt failed: {error message}"
  - "Draft prompt failed: {error message}"
- Return partial results if one succeeds and one fails
- Response should indicate which call failed and why

**Frontend**:
- Show loading state: "Running saved prompt..." / "Running draft prompt..."
- Display partial results if available (one succeeded, one failed)
- Show error message in the failed column with actionable guidance:
  - Timeout: "Prompt timed out. Try a simpler test query or reduce max_tokens."
  - API Error: "API call failed: {message}. Check your API key or try again."
  - Network Error: "Network error. Check your connection and retry."

## Task Type

implement

## Blocked By

(none)

## Principles

- actionable-errors (core)
- prefer-small-executable-tasks (local)

## Guidance

### Actionable Errors

Error messages should tell you what to do next, not just what went wrong.

**Good error messages:**
- Identify what failed
- Explain why (if known)
- Suggest a concrete next step

**Bad error messages:**
- Generic ("Something went wrong")
- Blame without guidance ("Invalid input")
- Jargon without context ("ECONNREFUSED")

Examples:
- ❌ "Error: timeout"
- ✅ "Request timed out after 30s. Try reducing the file size or splitting into smaller chunks."

- ❌ "Invalid API key"
- ✅ "API key not found. Set ANTHROPIC_API_KEY in your .env file."

- ❌ "Command failed"
- ✅ "npm install failed because package.json is missing. Run 'npm init' first."

Error messages are UI. They deserve the same care as any user-facing text.

**Parent Principle:** (none)

**Sub-Principles:** (none)

### Prefer Small Executable Tasks

This principle keeps agent work concrete and safe.

- Prefer tasks that can be completed and verified in one session.
- Write tasks in terms of visible outcomes, not vague investigation.
- Capture current reality as facts before changing system behavior.
- Use ideas for later possibilities and tasks for immediate execution.

**Parent Principle:** (none)

**Sub-Principles:** (none)

## Definition of Done

- Backend adds 30s timeout to both `pipeline._call()` invocations in `/admin/prompts/compare`
- Backend returns partial results when one call succeeds and one fails
- Backend error responses include specific error type and actionable message
- Frontend displays progressive loading state ("Running saved prompt..." / "Running draft prompt...")
- Frontend shows partial results if available
- Frontend displays error messages in the failed column with actionable guidance
- Manual testing confirms:
  - Timeout behavior works (can test by temporarily lowering timeout)
  - Partial results display correctly
  - Error messages are clear and actionable
- Task file is deleted in the commit
