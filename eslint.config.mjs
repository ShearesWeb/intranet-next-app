import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
	...nextVitals,
	...nextTs,
	{
		// eslint-config-next 16 brought in the React Compiler rules of react-hooks v7, which
		// flag hooks written before them (mostly setState inside an effect). Warn until
		// that code is reworked, so the upgrade does not also refactor every hook.
		rules: {
			"react-hooks/set-state-in-effect": "warn",
			"react-hooks/refs": "warn",
			"react-hooks/purity": "warn",
			"react-hooks/immutability": "warn",
		},
	},
	globalIgnores([".next/**", ".open-next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
