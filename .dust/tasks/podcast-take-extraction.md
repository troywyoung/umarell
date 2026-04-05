# Podcast Take Extraction

Implement LLM-powered extraction of interesting claims from podcast transcripts. Uses Gemini 2.5 Flash to identify 5 compelling takes with speaker attribution and timestamps. Includes post-extraction quality filter.

## Context

This is the core intelligence layer for podcast ingestion. Given a transcript, extract the most interesting claims that warrant full steel man analysis.

Quality matters: weak takes waste processing resources and degrade feed quality. Post-extraction filter ensures only worthy claims proceed.

Preserves speaker voice (no reformatting) and extracts speaker names for attribution.

## Resolved Questions

(none)

## Implements Idea

(none)

## Task Type

implement

## Blocked By

(none)

## Principles

- prefer-small-executable-tasks
- functional-core-imperative-shell
- context-window-efficiency
- comprehensive-test-coverage

## Guidance

### Prefer small executable tasks

This principle keeps agent work concrete and safe.

- Prefer tasks that can be completed and verified in one session.
- Write tasks in terms of visible outcomes, not vague investigation.
- Capture current reality as facts before changing system behavior.
- Use ideas for later possibilities and tasks for immediate execution.

### Functional core imperative shell

Separate code into a pure "functional core" and a thin "imperative shell." The core takes values in and returns values out, with no side effects. The shell handles I/O, orchestrates the core functions, and manages external interactions.

This separation makes code easier to test (core is pure), easier to reason about (side effects are isolated), and easier to modify (business logic doesn't depend on I/O specifics).

### Context window efficiency

Dust should be designed with short attention spans in mind. Information should be structured to minimize the amount of context that must be held in working memory at once. This applies to both human users and AI agents reading project documentation or code.

Use progressive disclosure, clear boundaries between concerns, and concise artifacts that can be understood in isolation.

### Comprehensive test coverage

A project's test suite is its primary safety net, and agents depend on it even more than humans do. When changes introduce bugs, tests should catch them immediately. This means:

- Test all critical paths and edge cases
- Include both happy path and error scenarios
- Test at appropriate levels (unit for logic, integration for workflows)
- Make tests clear enough that failures are self-diagnosing

Comprehensive coverage doesn't mean 100% line coverage - it means the test suite gives you confidence to change code without fear.

## Definition of Done

- New function `extract_podcast_takes(transcript: dict, count: int = 5) -> list[dict]` in `api/transcript_service.py`
- Returns list of dicts: `[{"claim": str, "speaker": str, "start": float, "end": float, "quality_score": int}]`
- New prompt `extract_podcast_takes` in `api/prompts.py` following existing pattern
- Prompt instructs LLM to:
  - Find 5 most interesting claims (bold predictions, contrarian opinions, provocative insights)
  - Preserve speaker's exact words (no reformatting)
  - Extract speaker name from transcript
  - Identify timestamp range for each claim
  - Return as JSON array
- Post-extraction quality filter: score each take 0-100, only return takes with score >= 70
- Quality scoring considers: specificity, controversy, insight depth, backing evidence
- Uses Gemini 2.5 Flash (existing `_call()` function with default provider)
- Handles long transcripts (up to 100K chars via 1M token context window)
- Error handling: LLM returns empty list, malformed JSON, missing speaker, invalid timestamps
- Unit tests in `api/test_transcript_service.py`:
  - Mock LLM response with 5 valid takes
  - Mock LLM response with quality scores (some below threshold)
  - Verify filtering logic
  - Error cases (empty response, malformed JSON)
- Integration test with real transcript sample (mock or fixture)
- Task file deleted, atomic commit created
