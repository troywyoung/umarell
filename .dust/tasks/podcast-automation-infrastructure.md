# Podcast Automation Infrastructure

Prepare minimal schema and webhook scaffolding for future podcast automation. This keeps manual ingestion as the current path while making later automation easier.

## Task Type

implement

## Blocked By

(none)

## Definition of Done

- Add a `PodcastFeed` table with URL, name, auto-ingest flag, last-checked timestamp, and created-at timestamp.
- Add a `POST /podcasts/webhook` endpoint that returns 501 Not Implemented with guidance to use manual ingestion.
- Log webhook receipt for future automation work.
- Add tests for webhook 501 behavior and basic `PodcastFeed` CRUD.
