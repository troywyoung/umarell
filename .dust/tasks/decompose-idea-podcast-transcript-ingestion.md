# Decompose Idea: Podcast Transcript Ingestion

Create one or more well-defined tasks from this idea. Prefer smaller, narrowly scoped tasks that each deliver a thin but complete vertical slice of working software -- a path through the system that can be tested end-to-end -- rather than component-oriented tasks (like "add schema" or "build endpoint") that only work once all tasks are done. Split the idea into multiple tasks if it covers more than one logical change. Run `dust principles` to identify relevant principles (both core and local), then inline the FULL content of ALL selected principles in a Guidance section in each new task file (after Principles but before Definition of Done). This ensures implementing agents read the guidance without extra tool calls. Also run `dust facts` for design decisions that should inform the task. See [Podcast Transcript Ingestion](../ideas/podcast-transcript-ingestion.md).

## Resolved Questions

### How should transcript fetching handle authentication?

**Decision:** Option: Public transcripts only

### How many takes should be extracted per episode?

**Decision:** Option: Fixed count (always 5)

### Should takes be ranked or displayed in chronological order?

**Decision:** Option: Chronological order (transcript sequence)

### How should timestamps be handled?

**Decision:** Option: Timestamp-aware take extraction

### Should episode ingestion be synchronous or async?

**Decision:** Option: Hybrid (fast-fail sync, then async)

### How should failed take extractions be handled?

**Decision:** Option: Fail entire ingestion

### Should the system support audio-only ingestion (no transcript)?

**Decision:** Option: Require transcript (no audio processing)

### Which LLM provider should be used for take extraction?

**Decision:** Option: Gemini 2.5 Flash

### Should podcast takes preserve speaker voice or use Umarell formatting?

**Decision:** Option: Preserve speaker voice (skip format_thesis)

### How should speaker attribution be handled?

**Decision:** Option: Speaker name extraction

### Should the system deduplicate episodes?

**Decision:** Option: Allow duplicates

### Where should the ingestion UI live?

**Decision:** Option: Admin panel only (Phase 1)

### Should low-quality takes be filtered or trusted to LLM?

**Decision:** Option: Post-extraction quality filter

### Should episode monitoring/automation be designed now or deferred?

**Decision:** Option: Design for automation upfront


## Decomposes Idea

- [Podcast Transcript Ingestion](../ideas/podcast-transcript-ingestion.md)


## Task Type

decompose

## Blocked By

(none)


## Definition of Done

- One or more new tasks are created in .dust/tasks/
- Task's Principles section links to relevant principles from .dust/principles/
- The original idea (.dust/ideas/podcast-transcript-ingestion.md) is deleted or updated to reflect remaining scope
