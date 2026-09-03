# Phase 01 — API Coverage Declaration

**Decided:** 2026-09-04 (plan-phase)
**Detector result at plan time:** `api-coverage.cjs --json` over the ROADMAP phase scope returned `{"detected":false,"skipped":false}`.

## No external API integration

This phase integrates no external API, SDK, hosted service or MCP server. It **removes** application code from an existing Next.js app and speaks only to the project's own Supabase/PostgREST layer, which is pre-existing infrastructure rather than a new integration.

Concretely, the phase:

- adds one constant and one predicate to `src/types/facilities.ts`;
- adds a `.neq(...)` clause to two existing Supabase queries and a `.filter(...)` to one existing result map, all inside `src/lib/facilities/`;
- replaces one guard clause in `src/app/api/facilities/claims/route.ts` with another that calls an existing in-repo function;
- deletes four helper functions, one constant, one interface, one JSX block, one route branch and four hardcoded arrays;
- adds unit and integration test coverage for the above.

`package.json` gains no dependency (RESEARCH.md §Package Legitimacy Audit: "Not applicable — this phase installs no new npm packages"). No new endpoint, credential, webhook, OAuth flow or third-party SDK enters the codebase.

There is therefore no external API surface whose capabilities could be integrated or opted out of, and no capability matrix is applicable. This declaration exists so the `verify:pre` gate reads the same reasoned conclusion the planner reached, rather than re-deriving it from PLAN.md prose that mentions the project's own internal API routes.

## If this changes

Should a later plan in this phase introduce a call to any service outside this repository, that plan must replace this file with a full capability coverage matrix (`| capability | decision | reason |`, INTEGRATE by default, every OPT-OUT reasoned) before it is executed.
