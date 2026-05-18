/// <reference types="vitest/globals" />

declare global {
	// React 18 opt-in flag for act() test environment
	var IS_REACT_ACT_ENVIRONMENT: boolean;
}

export {};
