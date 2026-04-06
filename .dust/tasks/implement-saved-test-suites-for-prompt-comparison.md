# Implement Saved Test Suites for Prompt Comparison

Add the ability to save and reuse collections of test queries (test suites) for batch prompt comparison. Users can create named test suites with multiple queries, then run an entire suite against saved vs draft prompts in one click.

## Why

The current comparison tool requires entering a test query each time. This works for quick iteration but doesn't support comprehensive testing:
- No way to test edge cases simultaneously
- Can't ensure a prompt improvement doesn't regress on other inputs
- Manual re-entry of common test queries is tedious

Saved test suites enable:
- **Regression testing**: Ensure prompt changes don't break existing behaviors
- **Edge case coverage**: Test multiple scenarios in one operation
- **Efficiency**: Reuse standard test queries without re-entry
- **Quality validation**: Build confidence before committing prompt changes

## Current Behavior

**Single Query Comparison** (main.py:1205-1247):
```python
class PromptComparisonRequest(BaseModel):
    saved_prompt_key: str
    draft_system: str
    draft_max_tokens: int
    test_query: str  # Single query only
```

Frontend (AdminPanel.tsx:276-366):
- Single textarea for test query input
- "Run Comparison" returns one pair of results
- Results disappear when modal closes

## Desired Behavior

### Test Suite Management

**Data Model**:
```python
class PromptTestSuite(Base):
    __tablename__ = "prompt_test_suites"
    id: int (primary key)
    name: str (unique, required)
    description: str (optional)
    created_at: datetime
    updated_at: datetime

class PromptTestQuery(Base):
    __tablename__ = "prompt_test_queries"
    id: int (primary key)
    suite_id: int (foreign key to PromptTestSuite)
    query_text: str (required)
    order_index: int (for display ordering)
    created_at: datetime
```

**API Endpoints**:

1. `GET /admin/prompts/test-suites` - List all test suites
   - Returns: `[{id, name, description, query_count, created_at}]`

2. `POST /admin/prompts/test-suites` - Create new suite
   - Body: `{name, description, queries: [string]}`
   - Returns: `{id, name, description, queries: [{id, query_text, order_index}]}`

3. `GET /admin/prompts/test-suites/{id}` - Get suite details
   - Returns: `{id, name, description, queries: [{id, query_text, order_index}]}`

4. `PUT /admin/prompts/test-suites/{id}` - Update suite
   - Body: `{name?, description?, queries?: [{id?, query_text, order_index}]}`
   - Deletes queries not in request, updates existing, creates new

5. `DELETE /admin/prompts/test-suites/{id}` - Delete suite (cascade to queries)

6. `POST /admin/prompts/compare-suite` - Run batch comparison
   - Body: `{saved_prompt_key, draft_system, draft_max_tokens, suite_id}`
   - Returns: `{suite_name, results: [{query_text, saved_output, draft_output}]}`

### Frontend UI

**Test Suite Selector** (in prompt edit modal):
- Dropdown: "Select test suite" (shows all suites)
- Button: "Manage Test Suites" (opens suite editor modal)
- When suite selected, show query count and "Run Suite" button

**Test Suite Editor Modal**:
- List of existing suites with edit/delete actions
- "New Test Suite" button
- Suite form:
  - Name (required)
  - Description (optional)
  - Query list (add/remove/reorder)
  - Save/Cancel buttons

**Batch Results Display**:
- Show all query results in expandable/collapsible sections
- Each section: query text + side-by-side outputs
- Summary at top: X of Y queries showed differences

### Compatibility

Single query comparison (current behavior) remains available:
- Text input still works for ad-hoc testing
- "Run Comparison" button works as before
- Test suites are additive, not a replacement

## Task Type

implement

## Blocked By

(none)

## Principles

- prefer-small-executable-tasks (local)
- production-deployment-approval (local)

## Guidance

### Prefer Small Executable Tasks

This principle keeps agent work concrete and safe.

- Prefer tasks that can be completed and verified in one session.
- Write tasks in terms of visible outcomes, not vague investigation.
- Capture current reality as facts before changing system behavior.
- Use ideas for later possibilities and tasks for immediate execution.

**Parent Principle:** (none)

**Sub-Principles:** (none)

### Production Deployment Approval

Production is frozen by default for agent-driven changes. Production changes require explicit human signoff.

- Agent work should be validated locally or on staging environments first.
- Production deployment requires explicit human approval before proceeding.
- Agents should complete implementation and testing autonomously, then request approval for production deployment.
- This ensures safety while preserving agent autonomy in development environments.

**Parent Principle:** (none)

**Sub-Principles:** (none)

## Definition of Done

- Database migration adds `prompt_test_suites` and `prompt_test_queries` tables
- Backend implements all 6 test suite API endpoints (CRUD + batch compare)
- Frontend adds test suite selector to prompt edit modal
- Frontend implements test suite editor modal (create, edit, delete, reorder queries)
- Frontend displays batch comparison results in expandable sections with summary
- Single query comparison (ad-hoc mode) continues to work unchanged
- Manual testing confirms:
  - Create, edit, delete test suites works
  - Run batch comparison shows all results correctly
  - Suite selector integrates cleanly with existing comparison UI
- Task file is deleted in the commit
