# Podcast feed grouping UI

Group podcast takes from the same episode under a unified episode header in the feed, with links to the source.

## Context

Podcast ingestion is currently functional:
- Transcripts are fetched from YouTube URLs (`transcript_service.py:48`)
- Takes are extracted with speaker names and timestamps (`transcript_service.py:144`)
- Observations are created with `episode_tag` and `episode_title` fields (`models.py:68-69`)
- Frontend displays podcast takes with special background styling (`App.tsx:845`)

However, takes from the same episode appear as individual cards without clear grouping or episode context.

## Desired behavior

When podcast takes share the same `episode_tag`, they should be visually grouped in the feed:

1. **Episode header**: Display a collapsible header showing:
   - Podcast name (from `metadata.podcast_name` or default "Podcast")
   - Episode title (from `observation.episode_title`)
   - Link to YouTube video (stored where?)
   - Episode timestamp as clickable link to that point in video

2. **Nested take cards**: Under the header, show all takes from that episode
   - Each take preserves speaker name and timestamp
   - Clicking a take opens the detail view as normal

3. **Feed behavior**:
   - Episodes can be expanded/collapsed
   - New episodes appear at the top
   - Takes within an episode maintain chronological order

## Related files

- `app/src/App.tsx:820-860` - Feed rendering and PvA topic filter
- `api/models.py:68-69` - `episode_tag` and `episode_title` fields
- `api/main.py:881-912` - Podcast ingestion creates observations with episode metadata
- `app/src/types.ts:59-61` - TypeScript Observation type includes episode fields

## Open Questions

### Where should the YouTube URL be stored?

#### Add `source_url` field to Observation model

Add a new nullable field to store the original YouTube URL: `source_url: Mapped[str | None] = mapped_column(String, nullable=True)`. Set during podcast ingestion in `main.py:905` and display as link in episode header and detail view.

**Tradeoff**: Adds a database field that's only used for podcast observations.

#### Store URL in metadata JSON

Add to the existing `metadata` field (currently unused in Observation model). Store as `metadata["source_url"]`. No schema change required but less type-safe, relies on JSON structure.

**Tradeoff**: Harder to query, less discoverable in code.

#### Don't persist URL, derive from episode_tag

Require episode tags to encode video ID (e.g., `pva-2026-04-05-N-pust8qtGI`). Extract video ID from tag using regex and reconstruct URL as `https://youtube.com/watch?v={video_id}`.

**Tradeoff**: Fragile, couples tag format to implementation, breaks if tag changes.

### How should episode grouping affect filtering?

#### Show entire episode if any take matches

If any take in an episode matches the filter, show the whole episode group (all takes).

**Tradeoff**: Users see unrelated takes when filtering. More context but less precision.

#### Show only matching takes, break up episodes

Filter at the take level, potentially splitting up episode groups.

**Tradeoff**: Loses episode context, but more accurate filtering.

#### Show episode header with filtered takes

Display the episode header, but only include takes that match the filter underneath.

**Tradeoff**: Best of both worlds, but more complex UI state management.

### Should episode grouping be a separate feed view?

#### Episodes are the default "Podcast" topic filter

Keep current feed behavior (flat list) for other topics, but when "Podcast" topic is selected, switch to grouped episode view.

**Tradeoff**: Two different UX patterns in one feed. May feel inconsistent.

#### Always group when `episode_tag` is present

Automatically group any observations with `episode_tag` regardless of topic/filter.

**Tradeoff**: Makes feed layout less predictable. Mixed flat and grouped content.

#### Add toggle between flat and grouped views

Let user switch between "All Takes" and "Episodes" view modes.

**Tradeoff**: Additional UI complexity and state management.
