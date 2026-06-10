# Listening Topic Variety — Design

**Date:** 2026-06-10
**Problem:** Hörverstehen exercises repeat the same few topics. The worker prompt asks Gemini to "pick a varied topic at random", but LLMs mode-collapse onto a handful of high-probability topics regardless of temperature. Each request is independent, so nothing pushes variety.

**Fix:** Move the randomness out of the model and into the Worker, which has real `Math.random()`.

## Scope

`worker/index.ts` only. No DB change, no UI change, no new files (besides changelog/version bookkeeping).

## Components

1. **Topic pool.** Constant `TOPIC_DOMAINS`: ~10 domains (Alltag, Arbeit, Reisen, Essen, Gesundheit, Wohnen, Natur/Umwelt, Technik, Kultur/Freizeit, Gesellschaft), each with ~10 concrete topics written as English strings (the prompt is English). ~100 topics total.

2. **Level gating.** Abstract domains (e.g. Gesellschaft) carry `minLevel: 'B1'`. A1/A2 draw only from everyday domains; the per-level blueprint difficulty already shapes treatment.

3. **Two-axis randomness.** Per request the Worker picks (a) a random eligible domain, then a random topic inside it, and (b) one of ~8 "angles" (a small problem gets resolved, opinions differ, plans change, a surprising detail, advice is given, a misunderstanding clears up, a past experience, a comparison). ~100 × 8 ≈ 800 combos — repetition effectively gone without persisting history.

4. **Prompt change.** The "pick a varied, realistic everyday topic at random" lines in `buildPrompt` are replaced by the concrete topic and angle. Angles are phrased text-type-neutral, with an instruction to adapt freely if the angle doesn't suit the chosen text type (announcements vs dialogues).

## Error handling / testing

Picks happen before the Gemini call and cannot fail. Verification: `pnpm typecheck`, `pnpm build`, and a few manual generates against the local dev server to eyeball topic spread.

## Out of scope (considered, rejected for now)

- Persisting topics in `listening_rounds` + excluding recent ones (needs migration; pool size makes it unnecessary).
- User-facing topic category picker on the setup screen.
