# Phase 4: Member Ranking Module - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 04-member-ranking-module
**Areas discussed:** PointsRecapCard decomposition, rankMembers page decomposition, Atomic save fix (RANK-03), Module location & file migration

---

## PointsRecapCard Decomposition

| Option | Description | Selected |
|--------|-------------|----------|
| By concern | Extract hooks by concern (data, navigation, audio) + slide component + share utility | ✓ |
| By visual section | Extract each slide category as a separate component | |
| Minimal extraction | Only extract share image canvas and slide useMemo | |

**User's choice:** By concern
**Notes:** Full decomposition into useRecapData, useRecapNavigation, useRecapAudio hooks + RecapSlideContent component.

### Share Image Canvas

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone utility function | Pure function createRecapImageBlob() returning Promise\<Blob\> | ✓ |
| ShareImage component | React component with canvas and ref | |
| You decide | Claude picks | |

**User's choice:** Standalone utility function

### Slide Data Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Data-driven builder | Category config array generates slides, reduces repetition | ✓ |
| Keep explicit slide objects | Hand-written RecapSlide literals | |
| You decide | Claude picks | |

**User's choice:** Data-driven builder

### Audio Hook

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, separate hook | useRecapAudio() returns { play, stop, cleanup } | ✓ |
| Bundle with navigation | Include audio in useRecapNavigation | |
| You decide | Claude picks | |

**User's choice:** Yes, separate hook

---

## rankMembers Page Decomposition

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror Phase 3 pattern | useRankingEditor hook + PositionRankingCard component | ✓ |
| Finer decomposition | Additional ScoreSelect, RankingToolbar, UnrankedAlert components | |
| You decide | Claude picks | |

**User's choice:** Mirror Phase 3 pattern

### Ranking Logic Location

| Option | Description | Selected |
|--------|-------------|----------|
| features/ranking/utils/ | Pure functions in utils alongside metric/comment helpers | ✓ |
| Inside the hook | Keep in useRankingEditor | |
| You decide | Claude picks | |

**User's choice:** features/ranking/utils/

---

## Atomic Save Fix (RANK-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase RPC | Postgres function wrapping DELETE+INSERT in transaction | ✓ |
| Upsert + orphan cleanup | Upsert then delete missing rows | |
| You decide | Claude picks | |

**User's choice:** Supabase RPC with Liquibase changelog
**Notes:** User will run the Liquibase changelog through their own pipeline.

### Changelog Location

| Option | Description | Selected |
|--------|-------------|----------|
| scripts/migrations/ | New directory alongside scripts/ | |
| db/changelog/ | Standard Liquibase convention | ✓ |
| You decide | Claude picks | |

**User's choice:** db/changelog/

### RPC Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Thin wrapper | RPC just does atomic DELETE+INSERT, validation in TypeScript | ✓ |
| Full logic in DB | RPC validates, deletes, inserts | |

**User's choice:** Thin wrapper

---

## Module Location & File Migration

### PointsRecapCard Location

| Option | Description | Selected |
|--------|-------------|----------|
| Move to features/ranking/ | Colocate with ranking module | ✓ |
| Stay in src/components/dashboard/ | Keep as dashboard widget | |
| You decide | Claude picks | |

**User's choice:** Move to features/ranking/

### Ranking Types Location

| Option | Description | Selected |
|--------|-------------|----------|
| features/ranking/types/ | Dedicated types in ranking module | ✓ |
| src/types/ | Centralized types | |
| You decide | Claude picks | |

**User's choice:** features/ranking/types/

### API Route Cleanup Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Extract shared types only | Move shared types, leave routes | |
| Full API route cleanup | Refactor 417-line rankings route too | ✓ |
| Don't touch API routes | Leave routes as-is | |

**User's choice:** Full API route cleanup

### saveRankings Route Location

| Option | Description | Selected |
|--------|-------------|----------|
| Stay at src/app/api/user/saveRankings/ | User-level action, URL makes sense | ✓ |
| Move to features/ranking/ | Colocate in module | |
| You decide | Claude picks | |

**User's choice:** Stay in place

### rankMembers Layout Enhancement

| Option | Description | Selected |
|--------|-------------|----------|
| Leave as-is | Simple pass-through layout | |
| Add feature flag gate | memberRanking feature flag check | ✓ |
| You decide | Claude picks | |

**User's choice:** Add feature flag gate

---

## Claude's Discretion

- Exact file naming within features/ranking/ sub-directories
- How to split types between files in features/ranking/types/
- Whether RecapSlideContent is one component or split by variant
- Internal structure of the data-driven slide builder
- Whether to split useRecapData further

## Deferred Ideas

None — discussion stayed within phase scope.
