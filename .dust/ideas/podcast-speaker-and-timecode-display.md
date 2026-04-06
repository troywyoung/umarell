# Podcast speaker and timecode display

Display speaker names and timecodes for podcast takes in feed cards and detail view.

## Context

Podcast takes already capture speaker and timestamp metadata:
- `metadata.speaker` - Speaker name extracted from transcript (`api/main.py:897`)
- `metadata.timestamp` - Start time in seconds (`api/main.py:898`)
- `metadata.end_timestamp` - End time in seconds (`api/main.py:899`)

This metadata is stored but not currently displayed in the UI.

## Desired behavior

1. **Feed cards**: Show compact speaker + timecode
   - Format: "Speaker Name · 1:07:28"
   - Position: Below thesis, above or alongside metadata
   - Clickable timecode links to YouTube at that timestamp

2. **Detail view**: Prominent speaker attribution
   - Larger speaker name display
   - Timecode as clickable link
   - Optional duration (e.g., "1:07:28 - 1:08:15")

3. **YouTube linking**: Clicking timecode opens video at that moment
   - Format: `https://youtube.com/watch?v={video_id}&t={timestamp_seconds}`
   - Opens in new tab

## Implementation notes

Straightforward implementation - all data already exists:
- Frontend reads `metadata.speaker` and `metadata.timestamp` from Observation
- Format timestamp seconds into HH:MM:SS or MM:SS
- Construct YouTube URL with video ID and timestamp

## Related files

- `api/main.py:896-901` - Metadata storage during ingestion
- `app/src/App.tsx:844-890` - Feed card rendering
- `app/src/types.ts:30-35` - Observation type (needs metadata type definition)

## Open Questions

### How should timecode be formatted?

#### Always show hours (HH:MM:SS)

Display as "1:07:28" even for short podcasts. Consistent format across all episodes and clear what each number represents.

**Tradeoff**: Verbose for short clips (e.g., "0:02:15" feels cluttered).

#### Conditional format (MM:SS for < 1hr, HH:MM:SS for >= 1hr)

Show "2:15" for clips under 1 hour, "1:07:28" for longer. More compact and natural reading (people say "two minutes fifteen seconds").

**Tradeoff**: Inconsistent format can be confusing.

#### Always show minimal format (MM:SS)

Use "67:28" for 1hr 7min 28sec. Extremely compact and common in audio/video tools.

**Tradeoff**: Harder to read for long timestamps (e.g., "187:42" requires mental math).

### Where should speaker/timecode appear in the feed card?

#### After thesis, before tags

Place speaker/timecode between thesis and tag pills. Clear separation from thesis content and groups with other metadata (tags).

**Tradeoff**: Pushes tags and engagement bar lower, increases card height.

#### Above thesis, alongside episode title

Show speaker name where user name currently appears. Replaces "User name" for podcast takes and keeps card compact.

**Tradeoff**: Less prominent, easy to miss.

#### Inline with engagement bar

Add speaker and timecode to the bottom engagement bar: "Speaker Name · 1:07:28 | Score: 85 | Counter | Stress". Keeps card height minimal.

**Tradeoff**: Cluttered footer, competes with action buttons.

### Should timecode be a button or just a link?

#### Styled as subtle text link

Display as plain text with link styling: "Speaker Name · 1:07:28" (timecode underlined on hover). Minimal visual weight.

**Tradeoff**: May not be obvious it's clickable.

#### Icon + timestamp button

Show play icon or external link icon next to timestamp: "Speaker Name · ▶ 1:07:28" or "Speaker Name · 1:07:28 ↗". Clear affordance for interaction.

**Tradeoff**: Adds visual clutter.

#### Entire speaker/timecode row is clickable

Make the whole speaker attribution area clickable. Larger click target and more discoverable.

**Tradeoff**: Might conflict with card click to open detail view.
