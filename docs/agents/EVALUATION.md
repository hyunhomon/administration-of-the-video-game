# Evaluation suite — v0.0

## Offline fixtures
Use deterministic seed, recorded observation and mock Gemini responses to test schema validation, state transitions, contradiction handling, trust changes, quest branch, action legality and safe fallback.

## Online evaluation
Run provider-backed scenarios multiple times with temperature/config documented. Check persona differentiation, character knowledge boundaries, valid tool schemas, relevant recall, action completion, and timeout percentage. Record all generated action proposals, latency and actual engine results.

## Target gates (engineering goals, not measured results)
- 100% invalid/unauthorized model actions rejected.
- 100% multiplayer clients converge to the same server revision eventually.
- Party route demonstrably changes from human interventions in at least one rehearsed scenario.
- After disproven rumor, agent exhibits changed trust/memory in subsequent dialogue.
- No API keys in browser or checked-in files.

## Instrumentation
Trace IDs across user speech → agent decision → tool validation → game event. Show short rationale as authored summary, not chain-of-thought.
