# Build prompt comparison and testing interface

Create a prompt editing interface with live preview and side-by-side comparison. Admins test prompt changes and see output differences before deploying.

## Why

The current prompt management system allows editing prompts but lacks real-time preview capabilities. Admins can't see how prompt changes affect output without deploying to staging first, making prompt iteration slow and risky. A prompt comparison interface with live preview enables confident iteration.

## Current State

Prompt management exists (api/prompts.py defines 13 prompts: format_thesis, generate_steel_man, generate_counterpoint, etc.) and prompts are stored in the `instance_prompts` table with per-instance overrides. The admin panel has a test suite system for batch prompt comparison, but:
- No real-time preview window for single prompt execution
- No structured side-by-side comparison of saved vs. draft output
- No visual diff highlighting output differences
- No confidence metrics (token count, latency, cost estimate)

Resolved question: Prompt versioning will use Git-backed storage (Option 3), though this task focuses on the comparison UI first.

## Desired Behavior

**Prompt editor:**
- List all 13 prompts with expandable editor for each
- Show: prompt name, description, system prompt text, max_tokens, LLM provider
- Edit fields: system prompt, max_tokens, model selection (Gemini vs Anthropic)
- Save as draft without deployment

**Preview window:**
- Select a test query (from existing test suites or enter custom input)
- "Run Preview" button executes prompt with draft changes
- Show structured output: generated text, token count, latency, cost estimate
- Side-by-side comparison: saved prompt output vs. draft prompt output
- Highlight differences in output (text diff with color coding)

**Testing workflow:**
- Select existing test suite or create custom test queries
- Run batch comparison (saved vs draft) across all queries in suite
- Show results table: query | saved output | draft output | difference indicator
- Aggregate metrics: avg token count, avg latency
- Quality measurement via human evaluation only (resolved question: Option 1)

**Backend support:**
- New endpoint: `POST /admin/prompts/preview` for single draft prompt execution
- Accepts: prompt text, max_tokens, model, test query
- Returns: generated output, token count, latency, cost estimate

## Principles

### Unsurprising UX

The user interface should be as "guessable" as possible.

Following the [Principle of Least Astonishment](https://en.wikipedia.org/wiki/Principle_of_least_astonishment), users form expectations about how a tool will behave based on conventions, prior experience, and intuition. Dust's interface (including the CLI) should match those expectations wherever possible. If users are observed trying to use the interface in ways we didn't anticipate, the interface should be adjusted to meet their expectations — even if that means supporting many ways of achieving the same result.

Surprising behavior erodes trust and slows people down. Unsurprising behavior lets users stay in flow.

### Fast Feedback Loops

The primary feedback loop — write code, run checks, see results — should be as fast as possible.

Fast feedback is the foundation of productive development, for both humans and agents. When tests, linters, and type checks run in seconds rather than minutes, developers iterate more frequently and catch problems earlier. Agents especially benefit because they operate in tight loops of change-and-verify; slow feedback wastes tokens and context window space on waiting rather than working.

Dust should help projects measure the speed of their feedback loops, identify bottlenecks, and keep them fast as the codebase grows. This includes promoting practices like unit tests over integration tests for speed, incremental compilation, and check parallelisation.

### Prefer small executable tasks

This principle keeps agent work concrete and safe.

- Prefer tasks that can be completed and verified in one session.
- Write tasks in terms of visible outcomes, not vague investigation.
- Capture current reality as facts before changing system behavior.
- Use ideas for later possibilities and tasks for immediate execution.

### Fast Feedback

Dust should provide fast feedback loops for developers.

Faster feedback enables faster iteration, which compounds over time. Tests, CI checks, and local validation should return results quickly. Slow feedback loops discourage testing and experimentation, leading to less reliable code. Dust should help maintain fast feedback by encouraging fast tests, incremental checking, and parallel execution.

### Make changes with confidence

Developers should be able to modify code without fear of breaking existing behavior.

Confidence comes from two sources: comprehensive test coverage and fast feedback. When developers can run tests quickly and trust that those tests will catch regressions, they feel free to refactor, experiment, and improve code. Without confidence, codebases calcify as people become afraid to change anything.

Dust should help teams build and maintain the safety nets (tests, type checking, linting) that enable confident change, while keeping those safety nets fast enough that people actually use them.

## Task Type

implement

## Blocked By

(none)

## Definition of Done

- Prompt editor lists all 13 prompts with expandable editing UI
- Prompt editor allows editing system prompt, max_tokens, and model selection
- Preview window accepts test query and executes prompt with draft changes
- Preview shows structured output: text, token count, latency, cost estimate
- Side-by-side comparison displays saved vs. draft output
- Text diff highlights differences between outputs
- Backend endpoint `/admin/prompts/preview` executes draft prompts and returns metrics
- Batch testing runs saved vs. draft across multiple queries
- Results table shows comparison with aggregate metrics
- Implementation is complete and can be tested end-to-end
- Changes are committed atomically with this task file deleted
