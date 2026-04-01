# Steelman V2 — Product Spec

## Overview

A fundamental restructure of the Steelman output experience. Three distinct modes replace the current steel-man + stress-test tabs:

1. **Steelman** — The core argument, reformatted with a bottom-line verdict + detailed bullets
2. **Counterpoint** — An aggressive, adversarial challenge to the Steelman
3. **PvA Take** — The voice of People vs Algorithms (Troy, Brian, Alex) reacting to the claim

---

## 1. Steelman (replaces current steel-man tab)

### Input Processing
- User submits raw text, URL, or screenshot (unchanged)
- System formats input into a clear, punchy thesis
- **Hard rule**: The system can never change meaning or intent. It sharpens language, not position.

### Output Format

```
┌─────────────────────────────────────┐
│  THESIS                             │
│  "Formatted thesis statement"       │
├─────────────────────────────────────┤
│  BOTTOM LINE                        │
│  A single-sentence definitive       │
│  argument — the strongest version   │
│  of why this claim holds up.        │
├─────────────────────────────────────┤
│  THE CASE                           │
│  • Bullet 1 — evidence point        │
│  • Bullet 2 — evidence point        │
│  • Bullet 3 — evidence point        │
│  • Bullet 4 — evidence point        │
│  • Bullet 5 — evidence point        │
├─────────────────────────────────────┤
│  [Counterpoint]     [PvA Take]      │
└─────────────────────────────────────┘
```

**Bottom Line**: 1-2 sentences. The strongest, most concise version of the argument. Think of it like a verdict — "Here's why this holds up." This is the headline takeaway.

**The Case**: 4-6 bullets. Each bullet is a discrete evidence-backed argument supporting the thesis. Sourced where possible. Max 30 words per bullet. No fluff.

### Data Model Change
The `summary` field currently stores the full steel-man text. Restructure to JSON:

```json
{
  "bottom_line": "Single sentence verdict for the thesis",
  "bullets": [
    "Evidence point 1...",
    "Evidence point 2...",
    "Evidence point 3..."
  ]
}
```

---

## 2. Counterpoint (replaces Stress Test)

### Concept
An aggressive, well-reasoned challenge to the Steelman. Not a balanced pros/cons list — a direct adversarial argument designed to tear the thesis apart. Think: the best opposing counsel.

### Trigger
- Button labeled **"Counterpoint"** appears after Steelman completes
- Lazy-loaded on tap (same pattern as current stress test)

### Output Format

```
┌─────────────────────────────────────┐
│  COUNTERPOINT                       │
├─────────────────────────────────────┤
│  BOTTOM LINE                        │
│  A single-sentence definitive       │
│  rebuttal — why this claim fails.   │
├─────────────────────────────────────┤
│  THE CASE AGAINST                   │
│  • Counter-bullet 1                 │
│  • Counter-bullet 2                 │
│  • Counter-bullet 3                 │
│  • Counter-bullet 4                 │
├─────────────────────────────────────┤
│  VERDICT                            │
│  "After considering both sides..."  │
│  One paragraph. Does the original   │
│  thesis survive the counterpoint?   │
└─────────────────────────────────────┘
```

**Bottom Line**: 1-2 sentences. The single strongest reason the thesis is wrong.

**The Case Against**: 4-6 bullets. Each one is a targeted attack on the thesis or its supporting evidence. Aggressive but intellectually honest. Sourced where possible.

**Verdict**: 2-3 sentences. After weighing the Steelman and the Counterpoint, does the original thesis hold up, partially hold up, or collapse? This is the referee's call.

### Tone
- Confident, direct, adversarial
- Not mean — sharp
- Think: a brilliant opposing debater who respects the argument but wants to destroy it
- Uses phrases like "This ignores...", "The data actually shows...", "The fatal flaw here is..."

### Data Model

```json
{
  "bottom_line": "The single strongest rebuttal",
  "bullets": [
    "Counter-argument 1...",
    "Counter-argument 2..."
  ],
  "verdict": "After weighing both sides..."
}
```

Stored in the existing `stress_test` JSON field on the Observation model.

---

## 3. PvA Take (NEW)

### Concept
The voice of **People vs Algorithms** — the amalgam perspective of Troy Young, Brian Morrissey, and Alex Schleifer. This is an opinionated, media-industry-informed reaction to the claim. Not neutral analysis — a *take*.

### Voice Profile
The PvA voice should be trained on / informed by:
- All People vs Algorithms podcast transcripts
- All newsletter content from peoplevsalgorithms.com
- The editorial perspective: skeptical of hype, focused on structural change in media/tech/culture, practitioner-informed (not academic), conversational but sharp

**Voice characteristics:**
- Conversational and direct — like smart friends arguing at dinner
- Skeptical of narratives, especially Silicon Valley consensus
- Focused on power dynamics: who wins, who loses, what's the business model
- References real-world examples and pattern recognition over theory
- Comfortable saying "this is bullshit" or "this actually matters"
- Thinks in systems — how does this connect to bigger shifts in media, tech, culture
- Not cynical — genuinely curious, but with a high bar for claims

### Trigger
- Button labeled **"PvA Take"** appears after Steelman completes
- Lazy-loaded on tap

### Output Format

```
┌─────────────────────────────────────┐
│  PvA TAKE                           │
│  People vs Algorithms               │
├─────────────────────────────────────┤
│  2-3 paragraphs in the PvA voice.   │
│  Conversational, opinionated,       │
│  connecting the claim to bigger     │
│  patterns in media/tech/culture.    │
│                                     │
│  May agree, disagree, or reframe    │
│  the entire question.               │
├─────────────────────────────────────┤
│  TLDR                               │
│  One punchy sentence — the PvA      │
│  verdict on this claim.             │
└─────────────────────────────────────┘
```

### Data Model

```json
{
  "body": "2-3 paragraphs of PvA-voice commentary...",
  "tldr": "One punchy sentence verdict"
}
```

New JSON field `pva_take` on the Observation model.

### Training / Context Strategy

**Phase 1 (MVP)**: System prompt with detailed voice description + 5-10 curated excerpt examples from the podcast/newsletter that capture the tone. The prompt includes guidance on how Troy, Brian, and Alex each think.

**Phase 2**: RAG pipeline — ingest all podcast transcripts and newsletter archives into vector DB. On each claim, retrieve the most relevant PvA content and include it as context for the LLM to channel. This makes the voice authentic rather than generic.

**Phase 3**: Fine-tuned model or long-context prompt with full corpus. The PvA voice becomes a distinct personality rather than an approximation.

---

## UI Changes

### Output View Tabs → Buttons
Replace the current tab bar with action buttons below the Steelman output:

```
[Steelman output always visible — thesis + bottom line + bullets]

        [Counterpoint]     [PvA Take]
```

- Both buttons are secondary style (outline) until tapped
- Once loaded, content appears below the buttons (accordion-style, not tabs)
- Both can be open simultaneously — they stack

### Button Styles
- **Counterpoint**: Red outline, red text — adversarial energy
- **PvA Take**: Brand color (could use PvA purple/gradient) — editorial energy

### Loading States
Same pattern as current stress test — animated dots while generating.

---

## API Changes

### Modified Endpoints

**`POST /observations`** — Pipeline output changes:
- `summary` field becomes JSON `{ bottom_line, bullets }` instead of plain text

**`POST /observations/{id}/stress-test`** → **`POST /observations/{id}/counterpoint`**
- Returns `{ bottom_line, bullets, verdict }` instead of `{ pros, cons, verdict }`

### New Endpoint

**`POST /observations/{id}/pva-take`**
- Generates PvA-voice commentary
- Returns `{ body, tldr }`
- Stored in new `pva_take` JSON column on Observation

### Pipeline Changes

**`generate_steel_man()`** — Update system prompt:
- Output JSON with `bottom_line` + `bullets` instead of plain bullet list
- Emphasize: bottom line is the single strongest argument, not a summary

**`generate_stress_test()`** → **`generate_counterpoint()`**
- Rewrite system prompt for adversarial voice
- Output: `bottom_line` + `bullets` (case against) + `verdict`
- Drop the balanced pros/cons format — this is pure opposition

**`generate_pva_take()` (NEW)**
- System prompt embeds PvA voice profile + curated examples
- Takes thesis + steelman as context
- Returns `body` (2-3 paragraphs) + `tldr` (one sentence)

---

## Migration Path

1. **Database**: Add `pva_take` JSON column to observations. Rename `stress_test` usage to store counterpoint format (column name can stay for now).
2. **Pipeline**: Update `generate_steel_man` output format. Replace `generate_stress_test` with `generate_counterpoint`. Add `generate_pva_take`.
3. **API**: Add `/counterpoint` endpoint (can alias from `/stress-test` temporarily). Add `/pva-take` endpoint.
4. **Frontend**: Restructure OutputView — always show steelman (bottom line + bullets), add Counterpoint and PvA Take buttons below. Remove tab system.
5. **PvA Voice Training**: Start with curated prompt examples. Build toward RAG pipeline with full corpus.

---

## Open Questions

- **PvA content ingestion**: How do we get podcast transcripts? YouTube auto-captions? Manual transcription? Existing transcript service?
- **Newsletter archive**: Can we scrape/export the full peoplevsalgorithms.com archive for RAG?
- **Voice balance**: Should the PvA take lean more toward one voice (Troy vs Brian vs Alex) or always be a blend?
- **Challenges feature**: Does the existing user-submitted challenge flow stay alongside these system-generated counterpoints? Or does Counterpoint replace it?
- **Score**: Does the 0-100 score still exist? Could the Counterpoint verdict replace it?
