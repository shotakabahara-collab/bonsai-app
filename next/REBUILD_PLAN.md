# BONSAI React rebuild v1

## Purpose

Replace the accumulated single-file/PWA hotfix chain with a typed, testable application that can be validated in an iPhone-sized WebKit browser before production promotion.

## Included vertical slice

- React + TypeScript + Vite application shell
- safe synchronous boot screen and React error boundary
- migration from `bonsai_live_1` to versioned `bonsai:v2` state
- one-to-three bonsai data model unlocked by reputation
- 10× in-game time progression
- watering, fertilizing, part-specific irreversible pruning and wiring
- disease, pest, jin and shari state model and treatment UI
- pots, weekly asynchronous exhibition, people and memorial screens
- local 900×1500 photoreal black-pine assets with five same-tree pot states
- local image manifest, attribution and offline caching
- custom service worker with navigation fallback
- iPhone-sized Playwright WebKit migration and interaction test

## Validated candidate

The isolated candidate has passed TypeScript typechecking, the Vite production build, legacy-save migration, a 390×844 / DPR 3 WebKit launch, watering, irreversible part pruning, persistence and show-page rendering. The final visual pass is repeated after every local photo-asset change.

## Promotion gate

This branch must not replace `main` until typecheck, production build, legacy-save migration, iPhone-sized WebKit launch, pruning persistence, local photo decoding and visual screenshot audit all pass on the final branch head. The production switch must then be followed by a public GitHub Pages WebKit smoke test.
