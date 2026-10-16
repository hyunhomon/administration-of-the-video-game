# Hackathon track and judging alignment

## Official project identity
- English title: **Administration of the Video Game**
- Korean title: **전자오락관리국**
- Repository slug: `administration-of-the-video-game`
- Primary track: **Track 1 — Gemini 4 Argon in entertainment**
- Secondary technical relevance: **Track 4 — Open innovation — autonomous agents and developer tools** (not the submission category unless the organizers allow reclassification).

## Track 1 definition
The organizers ask for new experiences in music, TV, film, webtoons and gaming using Gemini 4 Argon, Google AI Studio, Antigravity, and generative media models. The guide specifically describes Argon as a game master and multimodal orchestrator for games. Our project creates a different interaction: humans participate in an RPG as NPCs while four AI agents are the adventurers. This is primarily a **gameplay experience**, not a general-purpose agent framework.

## Evaluation criteria and concrete evidence
### 1. Working Live Demo / Demo Video
- Run a browser-based game with real movement, interaction, dialogue, and 4 visible agent avatars.
- Record an uninterrupted working scenario with a real prompt affecting route choice.
- Use `gemini-4-argon` through Google AI Studio **if the hackathon credentials actually expose it**; log the model ID in a server-side diagnostic.
- Verification loop: validate proposed actions against world state and tool schemas; execute legal actions; observe results; update memories and goals; assert expected invariants. Include automated deterministic tests and visible trace.
- Provide a stable recorded fallback if live API or deployment fails, but do **not** present a scripted replay as a live AI demonstration.

### 2. Problem & Impact
- Target: game creators, players, and interactive-story designers seeking reactive characters and emergent narrative without authoring every branch.
- Specific problem: traditional RPG NPC/player dialogue is mostly scripted, expensive to branch, and rarely changes independent party decisions.
- Demonstrate a reusable agent-to-game-state adapter as a potential post-hackathon open-source building block.
- Avoid claims of market demand without validation.

### 3. Originality & Creativity
- Four autonomous adventurers are the *players*; human participants are *NPCs*, reversing the classic JRPG relationship.
- Personalities, conflicting goals, persistent memory, trust, and joint decisions produce verifiable branching choices.
- Emphasize long-context grounding over world lore/history, planner + execution + verification, and optional multimodal presentation only if working.
- Do not falsely claim that 1M context or long decode was exercised unless measured and evidenced in the demo.

### 4. Clarity of Description
- Lead with one sentence: **“Four AI heroes play an RPG. You are the NPC who changes their quest.”**
- Show input -> agent belief update -> party disagreement -> route change in under 90 seconds.
- Before/after scene: identical world state, different human NPC statement, clearly different measurable agent outcome.
- Give a short target-audience and product-value line in the pitch.

## Submission deliverables
1. Live GCP URL; smoke-tested by a fresh browser session.
2. 60–120 second screen recording with captions in English.
3. GitHub repository and clear setup instructions.
4. A reproducible verification trace and tests.
5. README with screenshots, technology, licenses, and limitations.

## Scope boundaries
This is a hackathon prototype, not a completed Dragon Quest game. Use original/reusable-licensed assets. Implement deterministic simulation rather than an unconstrained hallucinated world.
