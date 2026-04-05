# Admin Podcast Ingestion Endpoint

Implement `/podcasts/ingest` endpoint that orchestrates transcript fetch, take extraction, and observation creation. Admin-only, hybrid sync/async flow. Integrates with existing pipeline.

## Context

This endpoint brings together transcript fetching and take extraction into a complete vertical slice. Admin pastes YouTube URL, system fetches transcript, extracts 5 takes, creates observations, and processes them through existing steel man pipeline.

Hybrid approach: fast validation (5s timeout on transcript fetch) returns errors immediately, success spawns async processing. Admin polls for observation completion.

Reuses existing `/episodes/seed` patterns for auth, episode grouping, and async pipeline execution.

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
- make-the-change-easy
- fast-feedback
- comprehensive-test-coverage

## Guidance

### Prefer small executable tasks

This principle keeps agent work concrete and safe.

- Prefer tasks that can be completed and verified in one session.
- Write tasks in terms of visible outcomes, not vague investigation.
- Capture current reality as facts before changing system behavior.
- Use ideas for later possibilities and tasks for immediate execution.

### Make the change easy

For each desired change, make the change easy, then make the easy change.

This principle, articulated by Kent Beck, recognizes that the hardest part of a change is often not the change itself but the state of the code receiving it. When code resists a change, the right response is to first refactor until the change becomes straightforward, and only then make it. The warning - "this may be hard" - acknowledges that preparing the ground takes real effort, but the result is a change that fits naturally rather than one forced in against the grain.

Work that supports this principle includes refactoring before feature work, improving abstractions that make a category of changes simpler, and resisting the urge to bolt changes onto code that isn't ready for them.

### Fast feedback

Dust should provide fast feedback loops for developers. The primary feedback loop — write code, run checks, see results — should be as fast as possible. When feedback must be slow (CI builds, long test suites), offer coping strategies rather than pretending it can be eliminated.

For users, fast feedback means immediate error detection, synchronous validation, and progressive disclosure of async results.

### Comprehensive test coverage

A project's test suite is its primary safety net, and agents depend on it even more than humans do. When changes introduce bugs, tests should catch them immediately. This means:

- Test all critical paths and edge cases
- Include both happy path and error scenarios
- Test at appropriate levels (unit for logic, integration for workflows)
- Make tests clear enough that failures are self-diagnosing

Comprehensive coverage doesn't mean 100% line coverage - it means the test suite gives you confidence to change code without fear.

## Definition of Done

- New endpoint `POST /podcasts/ingest` in `api/main.py`
- Request schema: `PodcastIngest(url: str, episode_title: str, episode_tag: str | None, podcast_name: str | None, count: int = 5, author_name: str = "Podcast", admin_key: str | None)`
- Auth: requires `admin_key` matching `settings.google_api_key` (follows `/episodes/seed` pattern)
- Flow:
  1. Validate auth (401 if missing/wrong)
  2. Fetch transcript with 5s timeout (uses `fetch_youtube_transcript()`)
  3. If fetch fails, return 400 with actionable error immediately
  4. If success, extract takes (uses `extract_podcast_takes()`)
  5. If extraction fails, return 500 with error
  6. Generate `episode_tag` from title if missing (slug)
  7. For each take: create `Observation(raw_input=take["claim"], input_type="text", episode_tag, episode_title, metadata={"speaker": ..., "timestamp": ...})`
  8. Skip `format_thesis` step (preserve speaker voice per decision)
  9. Spawn `_run_pipeline()` for steel man generation (async)
  10. Return 202 with observation IDs
- Response schema: `{"episode_tag": str, "episode_title": str, "podcast_name": str, "observations": [str], "count": int, "transcript_length": int}`
- Error responses include actionable messages
- Unit tests in `api/test_main.py`:
  - Valid ingestion (mock transcript fetch, mock take extraction)
  - Auth failures (missing key, wrong key)
  - Transcript fetch failures (invalid URL, no captions)
  - Extraction failures (empty list, malformed response)
  - Episode tag generation from title
- Integration test: full flow with real YouTube URL (or test fixture)
- Admin panel UI: new component `PodcastIngestionForm.tsx` in `app/src/components/admin/`
  - URL input field
  - Episode title input
  - Podcast name input (optional)
  - "Extract Takes" button
  - Progress indicator during processing
  - Display results: observation IDs with links
- Task file deleted, atomic commit created
