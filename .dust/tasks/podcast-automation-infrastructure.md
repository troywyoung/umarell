# Podcast Automation Infrastructure

Add minimal infrastructure for future podcast automation: `PodcastFeed` table and `/podcasts/webhook` endpoint stub. Does not implement full automation, but prepares architecture.

## Context

Per "Design for automation upfront" decision, this task adds the database schema and endpoint hooks needed for future RSS monitoring and webhook-based ingestion. The actual automation logic (polling, processing) is deferred.

This prepares the codebase without over-engineering. Future tasks can implement automation without schema changes.

## Resolved Questions

(none)

## Implements Idea

(none)

## Task Type

implement

## Blocked By

- [admin-podcast-ingestion-endpoint](admin-podcast-ingestion-endpoint.md)

## Principles

- prefer-small-executable-tasks
- some-big-design-up-front
- minimal-dependencies
- comprehensive-test-coverage

## Guidance

### Prefer small executable tasks

This principle keeps agent work concrete and safe.

- Prefer tasks that can be completed and verified in one session.
- Write tasks in terms of visible outcomes, not vague investigation.
- Capture current reality as facts before changing system behavior.
- Use ideas for later possibilities and tasks for immediate execution.

### Some big design up front

AI agents lower the cost of architectural exploration, making heavier upfront investment rational during the idea phase.

Before implementing a complex feature, spend time in the idea phase exploring approaches, identifying trade-offs, and making key architectural decisions. Document open questions and resolve them through research, prototyping, or user consultation. The decompose task type formalizes this: turn a well-researched idea into small, executable tasks.

This doesn't mean waterfall planning — it means investing in clarity before writing code, because agents make that investment cheaper than it used to be.

### Minimal dependencies

Dust should avoid coupling to specific tools so we can switch to better alternatives as they emerge. Prefer standard interfaces, simple abstractions, and lightweight integrations over heavy framework commitments.

When adding dependencies, consider: Is this solving a hard problem, or wrapping something simple? Will this still be the best choice in 2 years? Can we implement this ourselves in 50 lines?

### Comprehensive test coverage

A project's test suite is its primary safety net, and agents depend on it even more than humans do. When changes introduce bugs, tests should catch them immediately. This means:

- Test all critical paths and edge cases
- Include both happy path and error scenarios
- Test at appropriate levels (unit for logic, integration for workflows)
- Make tests clear enough that failures are self-diagnosing

Comprehensive coverage doesn't mean 100% line coverage - it means the test suite gives you confidence to change code without fear.

## Definition of Done

- New database table `PodcastFeed` in `api/models.py`:
  - Fields: `id` (UUID), `url` (str, unique), `name` (str), `auto_ingest` (bool, default False), `last_checked` (datetime, nullable), `created_at` (datetime)
  - Index on `url` for fast lookups
  - Index on `auto_ingest` for future polling queries
- Migration script to create table (if using migrations) or inline table creation
- New endpoint `POST /podcasts/webhook` in `api/main.py`:
  - Accepts generic webhook payload (JSON)
  - Returns 501 Not Implemented with message: "Webhook automation not yet implemented. Use /podcasts/ingest for manual ingestion."
  - Logs webhook receipt for future implementation reference
- No actual automation logic (polling, RSS parsing, auto-ingestion)
- Documentation comment in endpoint explaining future automation design:
  - Webhooks from RSS readers (Zapier, IFTTT, FeedBin)
  - Cron job to poll `PodcastFeed` table where `auto_ingest=true`
  - Process new episodes via `/podcasts/ingest` flow
- Unit tests:
  - Webhook endpoint returns 501
  - PodcastFeed table creation and basic CRUD
- Task file deleted, atomic commit created
