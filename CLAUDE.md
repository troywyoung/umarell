# Umarell

AI-powered observation engine. Standalone application — entirely separate from PIMP/PvA.

## What It Is

You make an observation. Umarell turns it into a thesis, researches it, and gives you a briefing.

Named after the Italian archetype of someone who watches the world with deep, knowledgeable attention.

## Key Concept: The Idea Button

The primary entry point — persistent, always accessible, one tap. Accepts 5 input types:
- **Text** — short typed observation
- **Voice** — spoken, transcribed and formatted
- **Photo** — camera image interpreted via vision AI
- **Screenshot** — screen capture, interpreted same as photo
- **URL** — fetched, parsed, core idea extracted

All five funnel into the same pipeline. No mode-switching friction.

## Core Loop

```
Capture → Format → Research → Structure → Brief
```

**Format step**: Before research, the system reformulates input as a 1–2 sentence thesis. User sees and can edit before research runs.

## Output Structure (6 layers)

1. **Thesis** — raw observation → clear, researchable thesis
2. **Summary** — concise synthesis of what it's about and why it matters
3. **Supporting Ideas** — 3–5 evidence points with source attribution
4. **Counter Ideas** — 3–5 alternative perspectives, challenges
5. **Context** — historical, cultural, industry, or political framing
6. **More Questions** — 3–5 follow-on threads, each tappable to start a new observation

## Stress Testing

First-class product behavior (not a sub-feature). Runs automatically as part of research pipeline.
- Identifies and names the thesis's core assumptions
- Surfaces strongest objection (the argument that would make the thesis false)
- Flags where evidence is thin, cherry-picked, or potentially circular
- Confidence signal: **Well-supported / Contested / Speculative**
- Tone: smart, slightly skeptical colleague — not dismissive, not a fact-checker

Counter ideas inform. Stress testing challenges. These feel tonally different.

## The Briefing

Separate high-quality output triggered by a dedicated button.
- Editorial prose voice, not bullet points
- 300–500 words, readable in 2–3 minutes
- Includes: thesis, key supporting/counter arguments, context, forward-looking observation
- Quality bar: **good enough to forward**
- Shareable as standalone artifact (copy, export, send)

## Experience Principles

- **Speed over perfection** — 90% answer in 30s beats 100% in 5min
- **Structure, not summarization** — more valuable than a Google search, not just faster
- **Curiosity compounds** — More Questions reward engagement over time
- **Quality is the brand** — if the Briefing reads like AI, it's not good enough
- **Invisible architecture** — 6 layers feel natural, not imposed

## Design Direction

**Mobile-first, phone-native**. The product lives on the phone and integrates with phone functionality:
- Share sheet integration (accept URLs, screenshots from any app)
- Voice capture from lock screen or widget
- Photo/screenshot capture from camera roll
- Notifications for monitoring updates on saved theses
- Export/share briefings via Messages, Mail, etc.

UI should be extremely simple — the complexity is in the output, not the interface.

## Prototype

Built as a feature within PIMP (pod-news-app). Prototype URL: https://pod-news-app-production.up.railway.app

Key learnings:
- 6-layer structure validated as the right shape
- News sources worked as initial data layer; expansion to analysis/academic will improve quality
- Observation → thesis → research flow is intuitive and fast
- Briefing button concept validated; output format needs dedicated design work

**Do not modify PIMP when working on Umarell.** They share conceptual DNA but are separate applications.

## Open Questions (as of March 2026)

- **Data sources**: RSS, newsletter integrations, licensed APIs (NewsAPI, Guardian), academic sources?
- **Search strategy**: Route by thesis type (geopolitics vs. VC vs. biology)?
- **Personalization**: How does a user's "universe" of trusted sources evolve over time?
- **Briefing format**: Named artifact, style guide, consistent structure and voice
- **Source quality**: How to flag low-confidence claims, prevent misinformation amplification?
- **Business model**: Subscription? Freemium with Briefing as premium? B2B (newsrooms, teams)?

## Stack (TBD)

Mobile-first. Likely React Native or native iOS first, with a shared Python/FastAPI backend that can reuse patterns from PIMP. Claude API for all AI processing (thesis formatting, research synthesis, briefing generation).

## Authors

Troy Young + Brian (named "The Idea Button" and championed the concept)
