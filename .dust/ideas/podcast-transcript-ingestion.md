# Podcast Transcript Ingestion

Enable automatic extraction and processing of podcast episodes. System fetches transcripts, identifies the best claims, and creates observations for each.

## Context

The Umarell observation engine currently processes individual text/URL/image inputs. This idea extends the system to accept entire podcast episodes as input, automatically extracting the most interesting claims and running them through the full steel man pipeline.

**Current relevant architecture:**
- `POST /episodes/seed` already exists for batch observation creation (api/main.py:662-692)
- Episode grouping via `episode_tag` and `episode_title` fields on Observation model
- URL fetching with paywall handling in `_fetch_url()` (api/pipeline.py:295-333)
- Async pipeline execution spawns multiple observations concurrently
- Each observation gets thesis formatting, steel man generation, metadata scoring

**The vision:** Point the system at a podcast episode URL. System fetches transcript, identifies 5 best takes, creates an observation for each, groups them under the episode, and pushes to feed.

## Implementation Approach

### High-Level Flow

```
Podcast URL → Fetch Transcript → Extract 5 Best Takes → Create Observations → Process Pipeline → Feed Display
```

### Core Components

#### 1. Transcript Fetching Service

**New module:** `api/transcript_service.py`

Handles multiple podcast sources:
- **Spotify** — Via unofficial API or RSS feed export
- **Apple Podcasts** — Via RSS feed or show notes URL
- **YouTube** — Via YouTube Transcript API or yt-dlp
- **Generic RSS** — Parse `<podcast:transcript>` tag from RSS 2.0 feed
- **Direct URL** — Fetch transcript page (HTML parsing like Substack)
- **Manual paste** — Accept raw transcript text

**Strategy (mirrors existing URL fetching pattern):**
1. Detect source type from URL pattern
2. Try specialized handler (Spotify, YouTube, etc.)
3. Fallback to Tavily Extract (for published transcript pages)
4. Fallback to direct HTTP + BeautifulSoup
5. Return raw transcript text (up to ~50K chars)

**Error handling:**
- Missing transcript → error message with manual paste option
- Transcript too long → truncate or process in segments
- Transcription service down → queue for retry

#### 2. Take Extraction from Transcript

**New function:** `extract_key_takes(transcript: str, count: int = 5) -> list[str]`

Uses LLM to identify most interesting claims from transcript.

**New prompt:** `extract_podcast_takes` in `api/prompts.py`:
```
You are analyzing a podcast transcript to identify the most compelling claims.

Find the {count} most interesting takes expressed during this episode. Look for:
- Bold predictions or forecasts
- Contrarian opinions that challenge conventional wisdom
- Provocative claims about trends, industries, or culture
- Strong value judgments that could spark debate
- Insights backed by specific examples or data

For each take, extract the core claim as a standalone sentence (1-2 sentences max).
Return as JSON array of strings.

Transcript:
{transcript}
```

**Output:** `["Claim 1", "Claim 2", ...]`

**Fallback:** If extraction fails or returns < count, accept whatever is returned (don't block on getting exactly 5).

#### 3. Podcast Ingestion Endpoint

**New endpoint:** `POST /podcasts/ingest`

**Request schema:**
```python
class PodcastIngest(BaseModel):
    url: str | None = None               # podcast URL (Spotify, Apple, YouTube, RSS)
    transcript: str | None = None        # or paste transcript directly
    episode_title: str                   # "The War on Slop - Episode 42"
    episode_tag: str | None = None       # auto-generated from title if missing
    podcast_name: str | None = None      # "This Week in Startups"
    count: int = 5                       # number of takes to extract
    author_name: str = "Podcast"         # displayed on observations
    admin_key: str | None = None         # auth
```

**Flow:**
1. Validate auth (admin only initially)
2. If `url` provided:
   - Call `fetch_podcast_transcript(url)` from transcript_service
   - Handle errors (missing transcript, timeout, etc.)
3. If `transcript` provided directly:
   - Use as-is
4. Generate `episode_tag` if missing (slug from episode_title)
5. Call `extract_key_takes(transcript, count)`
6. For each extracted take:
   - Create Observation(raw_input=take, input_type="text", episode_tag, episode_title)
   - Spawn `_run_pipeline()` async
7. Return `{episode_tag, episode_title, podcast_name, observations: [ids], count, transcript_length}`

**Response:**
```json
{
  "episode_tag": "this-week-in-startups-ep42",
  "episode_title": "The War on Slop - Episode 42",
  "podcast_name": "This Week in Startups",
  "observations": ["uuid1", "uuid2", "uuid3", "uuid4", "uuid5"],
  "count": 5,
  "transcript_length": 15234
}
```

#### 4. Frontend Integration

**New UI component:** `PodcastIngestionForm.tsx`

**Location:** Either in admin panel or main app (TBD based on audience)

**Features:**
- URL input field (Spotify, Apple Podcasts, YouTube, etc.)
- OR textarea for manual transcript paste
- Episode title input
- Podcast name input (optional)
- "Extract Takes" button
- Progress indicator (fetching transcript → extracting takes → processing observations)
- Display results: "5 observations created" with links to each

**Polling behavior:**
- After ingestion, poll each observation ID
- Display progress (formatting → researching → complete)
- Show live updates as steel mans complete

**Feed display:**
- Group observations by `episode_tag`
- Display episode header: podcast name + episode title
- Show all takes from episode in chronological order
- Optionally collapse/expand episode groups

#### 5. Episode Grouping UX Enhancement

**New feature:** Episode view in feed

**Changes to frontend:**
- Detect observations with same `episode_tag`
- Render as collapsible group with header
- Header shows: podcast name, episode title, take count, timestamp
- Expand to see all takes from episode
- Each take displays normally (thesis, steel man, score, etc.)

**Database query optimization:**
- Add index on `episode_tag` for fast grouping queries
- Endpoint: `GET /observations?episode_tag={tag}` returns all from episode

### Podcast Platform Support

#### Priority 1: Spotify Podcasts
- **Detection:** URL matches `spotify.com/episode/*`
- **Strategy:** Check for official transcript via Spotify Web API (if available)
- **Fallback:** Scrape show notes or use third-party transcript services
- **Challenge:** Spotify doesn't publicly expose transcripts for all shows

#### Priority 2: YouTube Podcasts
- **Detection:** URL matches `youtube.com/watch?v=*` or `youtu.be/*`
- **Strategy:** Use YouTube Transcript API (via `youtube-transcript-api` Python library)
- **Advantage:** Many podcasts have auto-generated or manual captions
- **Fallback:** yt-dlp to extract captions if API fails

#### Priority 3: RSS Feeds
- **Detection:** URL ends in `.xml` or `.rss`, or contains `/rss` or `/feed`
- **Strategy:** Parse RSS, look for `<podcast:transcript>` tag (Podcast 2.0 namespace)
- **Fallback:** Extract `<description>` or `<content:encoded>` for show notes
- **Example:** Many Substack podcasts include full transcripts in RSS

#### Priority 4: Generic Transcript URLs
- **Detection:** URL points to webpage (not audio file)
- **Strategy:** Use existing `_fetch_url()` logic (Tavily Extract → direct HTTP)
- **Examples:** Medium posts with transcripts, Substack posts, blog transcripts
- **Advantage:** Already implemented in codebase

#### Priority 5: Third-Party Transcription Services
- **AssemblyAI:** Upload audio file URL, get transcript via API
- **Deepgram:** Real-time or batch transcription
- **Rev.ai:** High-accuracy transcription
- **Challenge:** Requires API keys, costs money per minute
- **Use case:** For podcasts without existing transcripts

### Technical Considerations

#### Transcript Length Limits
- Transcripts can be 20K-100K chars (30-90 min episodes)
- Current `format_thesis()` prompt uses up to 8K chars of URL content
- **Solution:** For take extraction, pass full transcript to LLM (100K context window for Claude)
- For each individual observation, only the extracted take is formatted (short)

#### LLM Provider Selection
- **Gemini 2.5 Flash:** 1M token context, fast, cheap — good for long transcripts
- **Claude Sonnet:** 200K context, better quality — use for take extraction
- **Strategy:** Use Claude for `extract_key_takes()`, Gemini for steel mans (existing pipeline)

#### Async Processing Performance
- 5 takes = 5 concurrent pipeline executions
- Each pipeline: format_thesis (1s) + steel_man (2-3s) + metadata (1s) = ~5s total
- **Expected time:** ~5-10s for all 5 takes to complete (parallelized)
- No blocking — frontend polls for updates

#### Source Attribution
- Each observation's `sources` field should include podcast metadata
- Example: `{url: spotify_url, title: "This Week in Startups - Ep 42", timestamp: "12:34"}`
- **Enhancement:** Extract timestamp from transcript if speaker-turn format available

### Database Changes

**No schema changes required** — existing fields support this:
- `episode_tag` — groups observations by episode
- `episode_title` — display name
- `raw_input` — stores extracted take
- `input_type` — set to "text" for podcast takes
- `sources` — can include podcast URL and metadata

**Optional enhancement:**
- Add `podcast_metadata` JSON field to Observation model
  - Store: podcast_name, episode_number, spotify_url, duration, host_names, etc.
  - Enables richer podcast-specific UX later

### Admin vs. Public Access

**Phase 1: Admin-only**
- Ingestion endpoint requires admin auth
- Manual process: paste URL, click "Ingest"
- Use case: Editorial curation (select best episodes to process)

**Phase 2: Public self-service**
- Any user can submit podcast URL
- Rate-limited to prevent abuse (e.g., 3 episodes per day per user)
- Moderation queue: admin approves episodes before processing
- Use case: Crowdsourced content, community-driven feed

**Phase 3: Monitoring/Automation**
- Subscribe to podcast RSS feeds
- Auto-process new episodes on publication
- Opt-in for specific shows (e.g., "always process All-In Podcast")
- Use case: Automated content pipeline, daily feed of new takes

### User Experience Flow

#### Admin Flow (Phase 1)
1. Admin opens admin panel
2. Clicks "Ingest Podcast Episode"
3. Pastes Spotify/YouTube/RSS URL or raw transcript
4. Enters episode title and podcast name
5. Clicks "Extract Takes"
6. System shows progress: "Fetching transcript..."
7. System shows: "Found 5 takes from transcript"
8. System creates 5 observations, starts processing
9. Admin sees: "Processing 5 observations..."
10. Feed updates as observations complete
11. All 5 takes appear grouped under episode

#### End-User Flow (Phase 2)
1. User sees grouped episode in feed
2. Episode header shows: "This Week in Startups - The War on Slop"
3. User expands to see 5 takes
4. Each take displays: thesis, steel man, score, sources
5. User can respond to individual takes (existing functionality)
6. User can share entire episode or individual take

### Testing Strategy

**Unit tests:**
- `test_extract_key_takes()` — mock LLM response, validate parsing
- `test_fetch_podcast_transcript()` — mock HTTP responses for each platform
- `test_podcast_ingest_endpoint()` — full flow with mocked transcript fetch

**Integration tests:**
- Real Spotify URL (test episode with known transcript)
- Real YouTube URL (use youtube-transcript-api)
- Real RSS feed with transcript tag
- Error cases: missing transcript, malformed URL, API timeout

**Manual QA:**
- Process 3 episodes from different platforms
- Verify all 5 takes are high-quality (not just random sentences)
- Check episode grouping displays correctly in feed
- Test with very long transcript (90 min episode)

## Codebase Touchpoints

**New files:**
- `api/transcript_service.py` — podcast platform handlers
- `app/src/components/PodcastIngestionForm.tsx` — admin UI
- `app/src/components/EpisodeGroup.tsx` — feed display component

**Modified files:**
- `api/prompts.py` — add `extract_podcast_takes` prompt
- `api/main.py` — add `POST /podcasts/ingest` endpoint
- `app/src/App.tsx` — integrate episode grouping in feed view
- `app/src/AdminPanel.tsx` — add podcast ingestion tab

**Dependencies to add:**
- `youtube-transcript-api` (Python) — YouTube captions
- `feedparser` (Python) — RSS feed parsing
- Possibly `assemblyai` or `deepgram` (Python) — third-party transcription

## Success Metrics

This idea would be successful if:
- 95%+ of podcast URLs successfully fetch transcripts (across Spotify, YouTube, RSS)
- Extracted takes are subjectively "interesting" (not just first 5 sentences)
- Processing time < 15s from URL submission to all 5 observations complete
- Episode grouping is visually clear and useful in feed
- Zero cross-contamination between episodes (correct episode_tag assignment)

## Open Questions

### How should transcript fetching handle authentication?

#### Option: Public transcripts only

Many podcast platforms require user login to access transcripts. This option only processes podcasts where transcripts are publicly accessible.

Only process podcasts where transcripts are publicly accessible (YouTube, some RSS feeds, published web pages).

**Pros:**
- No auth complexity
- Works out of the box
- Sufficient for many use cases (YouTube podcasts very common)

**Cons:**
- Misses Spotify exclusives
- Misses paywalled podcast transcripts
- Limits content sources

**Implementation:**
- Detect auth-required URLs and show error: "Transcript not publicly available. Please paste transcript manually."

#### Option: User brings their own auth

User provides Spotify OAuth token, Apple ID cookies, etc. System uses their credentials to fetch.

**Pros:**
- Access to all content user can see
- No need for system-wide API keys
- Privacy-respecting (user controls data access)

**Cons:**
- Complex auth flow (OAuth per platform)
- Token management (storage, refresh, expiration)
- Risk of credential misuse
- Many podcasts still don't expose transcripts even with auth

**Implementation:**
- OAuth integration for each platform
- Store tokens in database (encrypted)
- Refresh tokens before each fetch

#### Option: System-wide API keys (admin-managed)

Admin configures API keys for transcription services (AssemblyAI, Deepgram, etc.). System uses these to generate transcripts on-demand.

**Pros:**
- Works for any podcast (even without existing transcript)
- Consistent quality (transcription APIs are accurate)
- Scalable (pay per minute used)

**Cons:**
- Costs money (typically $0.05-0.30 per minute)
- Requires admin to manage API keys
- Processing time (transcription takes ~1/4 of audio length)
- May not be needed (many podcasts already have transcripts)

**Implementation:**
- Admin sets API keys in settings
- System detects missing transcript, uploads audio URL to transcription service
- Polls for completion, retrieves transcript

### How many takes should be extracted per episode?

#### Option: Fixed count (always 5)

Every episode produces exactly 5 observations.

**Pros:**
- Predictable feed density
- Simple UI (no variable-length episode groups)
- Easy to compare episodes (all have same count)

**Cons:**
- Some episodes may not have 5 good takes (padding with weak claims)
- Some episodes may have 10+ great takes (misses content)
- One-size-fits-all doesn't match content variety

**Implementation:**
- Prompt instructs: "Find exactly 5 takes. If fewer than 5 exist, extract the best available."
- Accept whatever count is returned (may be 3-5)

#### Option: Variable count (3-10 based on episode quality)

LLM decides how many takes are worth extracting (minimum 3, maximum 10).

**Pros:**
- Better content quality (only good takes extracted)
- Respects episode variety (interview vs. monologue)
- Avoids padding with weak claims

**Cons:**
- Variable feed density (some episodes dominate feed)
- Harder to compare episodes
- May bias toward longer episodes (more content → more takes)

**Implementation:**
- Prompt instructs: "Find 3-10 takes depending on episode quality."
- UI shows take count in episode header ("5 takes" vs "3 takes")

#### Option: User-configurable count

Admin (or eventually user) specifies count at ingestion time.

**Pros:**
- Maximum flexibility
- Can adjust based on episode length, importance, audience
- Supports use cases like "just give me the top 3" or "extract everything"

**Cons:**
- More UI complexity
- Requires input field and validation
- Default value still needed

**Implementation:**
- Ingestion form has "Number of takes" field (default: 5)
- Backend accepts `count` parameter
- Prompt uses `{count}` variable

### Should takes be ranked or displayed in chronological order?

#### Option: Chronological order (transcript sequence)

After extracting takes, they can be ordered by appearance in transcript or by quality/interestingness.

Takes appear in the order they were spoken in the episode.

**Pros:**
- Respects narrative flow of episode
- Easier to follow if user listened to episode
- Timestamps make sense (if included)
- Natural ordering (no subjective ranking needed)

**Cons:**
- Best take may be buried in middle
- Doesn't optimize for engagement (hook at top)

**Implementation:**
- LLM preserves order when extracting
- Observations created in sequence
- Feed displays in order of `created_at`

#### Option: Ranked by interestingness

Takes sorted by quality score (most interesting first).

**Pros:**
- Best content surfaces first
- Higher engagement (users see strongest take immediately)
- More shareable (top take likely to be shared)

**Cons:**
- Loses narrative flow
- Subjective ranking (LLM's judgment may differ from user's)
- Harder to correlate with listening experience

**Implementation:**
- LLM returns takes with ranking score
- Sort by score before creating observations
- Add display order field to observations

#### Option: Hybrid (chronological with featured take)

Display takes chronologically, but highlight "best take" at top of episode group.

**Pros:**
- Best of both worlds
- Featured take grabs attention
- Chronological ordering still available below
- Respects both engagement and narrative

**Cons:**
- More complex UI (featured section + list)
- Requires ranking logic

**Implementation:**
- LLM returns takes with "featured" flag on best one
- UI renders featured take prominently, then others below

### How should timestamps be handled?

#### Option: Ignore timestamps

If transcripts include timestamps (speaker turns, segments), decide whether to preserve and display them.

Treat transcript as plain text, extract takes without time references.

**Pros:**
- Simpler processing (no parsing needed)
- Works with transcripts that lack timestamps
- Faster (no timestamp extraction logic)

**Cons:**
- Users can't jump to take in episode
- Less useful for listeners who want to verify context
- Misses opportunity for deep linking

**Implementation:**
- Strip timestamps during transcript fetch
- Extract takes from plain text

#### Option: Extract and store timestamps

Parse timestamps from transcript, attach to each observation as metadata.

**Pros:**
- Enables "jump to timestamp" links
- Users can hear context
- Better source attribution (not just episode, but moment)
- Potential for audio snippet playback

**Cons:**
- Requires parsing various timestamp formats (SRT, VTT, speaker-turn)
- Not all transcripts have timestamps
- More complex take extraction (LLM must identify which timestamp range)

**Implementation:**
- Parse timestamps into structured format `[{start: 123, end: 456, text: "..."}]`
- LLM extracts takes with reference to segments
- Store timestamp in `podcast_metadata` JSON field
- Frontend displays "Jump to 12:34 in episode" link

#### Option: Timestamp-aware take extraction

LLM identifies timestamp range for each take, stores as structured data.

**Pros:**
- Most accurate (take directly linked to audio segment)
- Enables audio snippet playback (12:34-13:45)
- Best user experience for verification
- Supports future "quote this section" feature

**Cons:**
- Complex LLM prompt (must return both take and timestamp)
- Requires transcript with timestamps (excludes some sources)
- Harder to validate (did LLM pick right timestamp?)

**Implementation:**
- Prompt: "For each take, identify the start and end timestamp where it was expressed."
- Return format: `[{take: "...", start: "12:34", end: "13:45"}]`
- Store in database, display as audio player scrubber

### Should episode ingestion be synchronous or async?

#### Option: Synchronous (wait for completion)

When admin submits podcast URL, API can either wait for all takes to be created before responding, or return immediately.

API fetches transcript, extracts takes, creates observations, returns when all complete.

**Pros:**
- Simple flow (submit → see results immediately)
- Admin knows exactly what was created
- No polling needed for ingestion status
- Errors surface immediately

**Cons:**
- Long wait time (30-60s for full flow)
- HTTP timeout risk for long transcripts
- Blocks admin from other actions
- Not scalable if processing many episodes

**Implementation:**
- `POST /podcasts/ingest` waits for all steps
- Returns observation IDs when done
- Frontend shows spinner until complete

#### Option: Async (return immediately)

API starts transcript fetch and take extraction in background, returns task ID. Admin polls for completion.

**Pros:**
- Fast response (submit → confirmation in <1s)
- Scalable (can process many episodes concurrently)
- No HTTP timeout issues
- Admin can continue working while processing

**Cons:**
- More complex flow (submit → poll → results)
- Need task status tracking system
- Errors discovered later (not at submission time)

**Implementation:**
- `POST /podcasts/ingest` returns `{task_id, status: "processing"}`
- New endpoint: `GET /podcasts/ingest/{task_id}` returns status + results
- Frontend polls every 2s until complete

#### Option: Hybrid (fast-fail sync, then async)

API validates URL and attempts quick transcript fetch (5s timeout). If successful, returns immediately and processes in background. If fails, returns error.

**Pros:**
- Fast feedback for errors (bad URL, no transcript)
- Non-blocking for successful cases
- Best UX (errors surface quickly, success doesn't block)

**Cons:**
- Most complex to implement
- Still need polling for final results
- Timeout tuning is tricky (too short = false failures)

**Implementation:**
- Quick validation: fetch transcript with 5s timeout
- If error, return 400 immediately
- If success, spawn background task, return 202 with task ID
- Frontend polls for observation IDs

### How should failed take extractions be handled?

#### Option: Fail entire ingestion

If LLM fails to extract takes (returns empty list, malformed JSON, etc.), system needs a recovery strategy.

Return error to admin, no observations created.

**Pros:**
- Clear feedback (nothing created if extraction fails)
- Admin can retry or fix transcript
- No partial/incomplete episodes in feed

**Cons:**
- All-or-nothing (even 1 good take is lost if extraction fails)
- Wastes transcript fetch effort
- Poor UX for transient failures

**Implementation:**
- Catch extraction errors, return 500
- Frontend shows: "Failed to extract takes. Please try again."

#### Option: Allow manual take entry

If extraction fails, show transcript to admin and let them manually select/type takes.

**Pros:**
- Always succeeds (fallback to human curation)
- Highest quality (human judgment)
- Useful for edge cases (bad transcripts, unusual formats)

**Cons:**
- Slow (manual work defeats automation benefit)
- Requires UI for manual entry
- Doesn't scale (can't process many episodes)

**Implementation:**
- On extraction failure, render transcript with "Select takes" UI
- Admin highlights text or types takes manually
- Submit to existing `/episodes/seed` endpoint

#### Option: Create observation from full transcript

If take extraction fails, create a single observation with the full transcript as raw_input.

**Pros:**
- Never fails (always creates something)
- Preserves content (can retry extraction later)
- Degrades gracefully

**Cons:**
- Full transcript is too long for thesis formatting (will truncate)
- Not useful in feed (not a "take")
- Clutters database with failed attempts

**Implementation:**
- Detect extraction failure
- Create single Observation(raw_input=transcript, status="error")
- Mark as "extraction failed" for admin review

### Should the system support audio-only ingestion (no transcript)?

#### Option: Require transcript (no audio processing)

If user provides audio file or podcast audio URL without transcript, decide whether system should generate one.

Only accept podcast URLs that have transcripts or manual transcript paste.

**Pros:**
- Simpler implementation (no transcription service)
- Faster processing (no transcription latency)
- No transcription costs

**Cons:**
- Excludes many podcasts (most don't publish transcripts)
- Requires manual transcription for audio-only content
- Limits content volume

#### Option: Optional transcription (via API)

If no transcript found, offer admin option to generate one via AssemblyAI/Deepgram.

**Pros:**
- Supports all podcasts (even without existing transcripts)
- High accuracy (modern APIs are 90%+ accurate)
- One-time cost (transcript cached for future use)

**Cons:**
- Costs money per episode (~$5-15 for 60 min)
- Processing time (5-15 min for 60 min episode)
- Requires API key management

**Implementation:**
- Detect missing transcript
- Show admin: "No transcript found. Generate one? (Est. cost: $8, time: 10 min)"
- If yes, upload audio to transcription service
- Poll for completion, store transcript, proceed to extraction

#### Option: Always attempt transcription

If no transcript found, automatically fall back to transcription service.

**Pros:**
- Fully automated (works for all audio content)
- No manual decision needed
- Maximizes content coverage

**Cons:**
- High costs (scales with episode count)
- Long processing times (10-15 min per episode)
- May transcribe content user didn't want processed

**Implementation:**
- Fetch transcript with fallback chain: RSS → YouTube → Transcription API
- Admin configures monthly transcription budget
- Stop auto-transcription when budget exceeded
