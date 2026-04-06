# Podcast audio segment playback

Extract and play audio segments corresponding to individual podcast takes, both in feed cards and detail view.

## Context

Podcast takes currently include precise timestamps:
- `metadata.timestamp` (start time in seconds) - `api/main.py:898`
- `metadata.end_timestamp` (end time in seconds) - `api/main.py:899`
- Timestamps come from YouTube transcript API - `transcript_service.py:109-112`

The original request asks to "pull that part of the audio to play in the take card and the detail page."

## Desired behavior

1. **Feed card**: Small inline audio player
   - Shows waveform or simple play/pause button
   - Plays just the segment (start → end timestamp)
   - Lightweight, doesn't block rendering

2. **Detail page**: Full audio player
   - Larger player with scrubbing controls
   - Shows full episode audio but seeks to relevant timestamp on load
   - Option to play just the segment or continue to full episode

3. **Audio source**: YouTube video audio
   - Extract audio from the YouTube URL
   - Serve as streamable segment

## Related files

- `api/transcript_service.py:109-112` - Segment timestamps in transcript data
- `api/main.py:896-901` - Timestamp metadata stored in observations
- `app/src/App.tsx:827-900` - Feed card rendering (where player would go)
- `api/models.py:68-69` - Episode metadata storage

## Dependencies

Would likely require:
- `yt-dlp` (Python) - Download YouTube audio
- `ffmpeg` - Extract audio segments
- Cloud storage (if pre-extracting) - S3, Railway volumes, etc.
- Audio player library (frontend) - `react-h5-audio-player`, `howler.js`, native `<audio>`

## Open Questions

### How should audio be extracted and stored?

#### Extract and store segments during ingestion

Download full episode audio during `/podcasts/ingest`. Use `yt-dlp` to extract audio track, split into segments using ffmpeg based on timestamps, upload segments to cloud storage (S3, Railway volumes, etc.), and store segment URLs in observation metadata.

**Pros**: Fast playback, no runtime processing, segments immediately available.

**Cons**: High storage cost, slow ingestion, legal/copyright concerns, must handle deletion.

#### Generate segments on-demand with caching

Generate audio segments when first requested. Client requests segment via API endpoint like `/audio/segment/{observation_id}`, server downloads full video audio via `yt-dlp`, extracts segment using ffmpeg, caches segment temporarily (24-48h TTL), and returns segment URL or streams directly.

**Pros**: No upfront storage, only cache popular segments, simpler legal position.

**Cons**: Slow first playback, requires ffmpeg and yt-dlp dependencies, cache invalidation complexity.

#### Use YouTube embedded player with timestamp

Embed YouTube video player with `?start={timestamp}` parameter. No audio extraction needed, client-side only, uses YouTube's infrastructure. Player shows video (can be hidden with CSS if needed).

**Pros**: Zero server-side processing, no storage, no legal concerns, works immediately.

**Cons**: Shows video UI (or requires hiding), requires internet, can't create seamless take-only clips.

#### Link directly to timestamped YouTube

Display link to `https://youtube.com/watch?v={video_id}&t={timestamp}`. Opens in new tab/window with no player in Umarell UI. Simplest implementation.

**Pros**: Zero implementation cost, no legal concerns.

**Cons**: Not integrated into UI, breaks user flow, doesn't feel native.

### What audio format should be used?

#### MP3

Standard format, widely supported. Good compression, broad compatibility. Requires encoding during extraction.

#### WebM/Opus

Modern web-optimized format. Better compression than MP3, excellent browser support, native format from YouTube.

#### AAC/M4A

Apple-preferred format. Good quality and compression with strong mobile Safari support.

### Should the player support full episode playback?

#### Segment only

Play only the extracted take (start → end timestamp). Simple and focused on the specific claim. Requires stopping playback at end timestamp.

**Tradeoff**: Users can't explore more context from the episode.

#### Full episode with segment highlight

Load full episode audio and seek to take timestamp. Shows the segment in context. Users can scrub forward/back to hear surrounding discussion. Needs UI to show current take boundaries.

**Tradeoff**: More complex player UI, larger file sizes if pre-extracted.

#### Both modes with toggle

Default to segment, but allow "Listen to full episode" button. Best flexibility but more complex state management.

**Tradeoff**: UI complexity, potential confusion about which mode is active.

### How should copyright and fair use be handled?

#### Only support podcasts with explicit permission

Manually maintain allowlist of podcast feeds. Get permission from podcast hosts, store in `PodcastFeed` model with `auto_ingest=True`, and reject ingestion for non-approved shows.

**Tradeoff**: Significantly limits content, requires manual partnerships.

#### Rely on fair use for short clips

Claim fair use for short segments (30-90 seconds). Only play the exact quote segment, always attribute speaker and link to source, claim educational/commentary purpose.

**Tradeoff**: Legal gray area, may attract takedown requests.

#### Defer to YouTube's licensing

Embed YouTube player or link to YouTube. Rely on YouTube's content ID and licensing. No direct audio hosting.

**Tradeoff**: Less control over UX, dependent on YouTube platform.
