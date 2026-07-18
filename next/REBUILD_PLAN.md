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
- local photoreal pine bridge via existing `photo-assets.js`
- custom service worker with navigation fallback
- iPhone-sized Playwright WebKit migration and interaction test

## Promotion gate

This branch must not replace `main` until typecheck, production build, legacy-save migration, iPhone-sized WebKit launch, pruning persistence and visual screenshot audit all pass.
