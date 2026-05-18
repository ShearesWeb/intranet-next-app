// Ambient declarations for the vitest test environment.
//
// Required because `vitest.config.mts` sets `globals: true`, which exposes
// `describe`, `it`, `expect`, etc. on the global scope without explicit imports.
// The triple-slash reference below brings those types into the TypeScript
// project.
//
// TODO (testing harness Task 3 — Vitest project split): once the project is
// split into a separate `tsconfig.test.json`, move this file there so test
// globals do not leak into the production type-scope. Tracked in
// docs/superpowers/plans/2026-05-18-testing-harness-phase-0.md Task 3.
/// <reference types="vitest/globals" />

// `IS_REACT_ACT_ENVIRONMENT` is a React Testing Library opt-in flag set by
// hook tests via `globalThis.IS_REACT_ACT_ENVIRONMENT = true` to enable act()
// warnings. React itself ships no ambient type for this — we declare it here.
//
// `var` (not `let`) is required: `declare global` only attaches the symbol to
// `globalThis` when declared as a `var`. This mirrors how vitest's own
// `globals.d.ts` declares its globals.
export {};
declare global {
	// eslint-disable-next-line no-var
	var IS_REACT_ACT_ENVIRONMENT: boolean;
}
