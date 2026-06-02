// Ambient declarations for the Vitest test environment.
//
// Scoped to the test TypeScript project (tsconfig.test.json) so test globals do
// NOT leak into the production type-scope (tsconfig.json). Previously lived at
// src/vitest.d.ts, which the main tsconfig picked up via its `**/*.ts` include.
//
// `vitest.config.mts` sets `globals: true`, exposing `describe`, `it`, `expect`,
// etc. on the global scope without explicit imports. The reference below brings
// those types into the test project.
/// <reference types="vitest/globals" />

// `IS_REACT_ACT_ENVIRONMENT` is a React Testing Library opt-in flag set by hook
// tests via `globalThis.IS_REACT_ACT_ENVIRONMENT = true` to enable act()
// warnings. React itself ships no ambient type for this — we declare it here.
//
// `var` (not `let`) is required: `declare global` only attaches the symbol to
// `globalThis` when declared as a `var`. This mirrors how Vitest's own
// `globals.d.ts` declares its globals.
export {};
declare global {
	// eslint-disable-next-line no-var
	var IS_REACT_ACT_ENVIRONMENT: boolean;
}
