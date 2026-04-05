# YouTube Podcast Transcript Extraction

Implement YouTube transcript fetching as the first podcast source. Supports both auto-generated and manual captions. Returns plain text transcript with timestamps.

## Context

Podcast ingestion starts with YouTube because:
- Public API available (youtube-transcript-api)
- High availability (most podcasts have captions)
- No authentication required
- Simple URL pattern detection

This is the foundation for podcast ingestion. Other sources (Spotify, RSS) follow the same pattern.

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
- actionable-errors
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

### Actionable errors

Error messages should tell you what to do next, not just what went wrong.

Good errors guide toward resolution: "Port 3000 is already in use. Stop the existing process or use PORT=3001." Bad errors just describe failure: "EADDRINUSE." The user should never have to google an error message to figure out how to proceed.

### Comprehensive test coverage

A project's test suite is its primary safety net, and agents depend on it even more than humans do. When changes introduce bugs, tests should catch them immediately. This means:

- Test all critical paths and edge cases
- Include both happy path and error scenarios
- Test at appropriate levels (unit for logic, integration for workflows)
- Make tests clear enough that failures are self-diagnosing

Comprehensive coverage doesn't mean 100% line coverage - it means the test suite gives you confidence to change code without fear.

## Definition of Done

- New file `api/transcript_service.py` with `fetch_youtube_transcript(url: str) -> dict` function
- Function returns `{"text": str, "segments": [{"start": float, "text": str}]}`
- URL pattern detection for youtube.com and youtu.be
- Error handling: invalid URL, video not found, no captions available
- Errors include actionable messages (e.g., "No captions found. Try a different video or paste transcript manually.")
- Unit tests in `api/test_transcript_service.py` covering:
  - Valid YouTube URL extraction
  - Auto-generated captions
  - Manual captions (when available)
  - Error cases (no captions, invalid URL, video not found)
- Integration test with real YouTube video (use public test video with known captions)
- Dependency added: `youtube-transcript-api` to requirements.txt
- Task file deleted, atomic commit created
