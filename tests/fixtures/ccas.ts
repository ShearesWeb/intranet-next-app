import type { Cca } from "./types";

// Spec § 5.3 — the 8 CCAs.
export const CCAS: readonly Cca[] = [
	{
		key: "volleyball",
		name: "Volleyball",
		type: "sports",
		tierType: "tier 1",
		description: "Primary sports CCA; full position roster including vice and team manager.",
	},
	{
		key: "basketball",
		name: "Basketball",
		type: "sports",
		tierType: "tier 1",
		description: "Sports foil — Nova is lead here; Declan must not have access.",
	},
	{
		key: "choir",
		name: "Choir",
		type: "culture",
		tierType: "tier 1",
		description: "Primary culture CCA.",
	},
	{
		key: "dance",
		name: "Dance",
		type: "culture",
		tierType: "tier 2",
		description: "Culture foil exercising tier 2 differences.",
	},
	{
		key: "drama",
		name: "Drama",
		type: "culture",
		tierType: "tier 1",
		description: "Sage's CCA — supports the triple-flag persona.",
	},
	{
		key: "shweb",
		name: "SHWEB",
		type: "committee",
		tierType: "none",
		description: "Primary committee with lead / maincomm / subcomm roster.",
	},
	{
		key: "secc",
		name: "SECC",
		type: "committee",
		tierType: "none",
		description: "Committee foil for cross-committee scoping.",
	},
	{
		key: "jcrc",
		name: "JCRC",
		type: "jcrc",
		tierType: "none",
		description: "Hall executive committee — no lead position; top is maincomm.",
	},
] as const;

