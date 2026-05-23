import type { CCAData } from "@/features/cca/types/cca-data";
import type { AuthenticatedUser } from "@/types/user";

export type RecapSlide = {
	id: string;
	eyebrow: string;
	title: string;
	description: string;
	statLabel?: string;
	statValue?: string;
	statNote?: string;
	bulletItems?: string[];
	supportingText?: string;
	supportingBulletItems?: string[];
	emphasis?: string;
	accent: string;
	kind?: "copy" | "reveal";
};

export type RecapTotals = {
	totalPoints: number;
	totalCcas: number;
	culturePoints: number;
	sportsPoints: number;
	committeePoints: number;
	blockPoints: number;
	supplementaryPoints: number;
	adhocPoints: number;
};

export type RecapData = {
	slides: RecapSlide[];
	totals: RecapTotals;
};

export type RecapCategoryConfig = {
	id: "culture" | "sports" | "committees" | "block" | "supplementary" | "adhoc";
	eyebrow: string;
	title: string;
	descriptionWhenPresent: (context: {
		count: number;
		points: number;
		user: AuthenticatedUser;
		ccas: CCAData[];
	}) => string;
	descriptionWhenEmpty: string;
	statLabel: string;
	accent: string;
	filter: (cca: CCAData) => boolean;
	buildSupportingText: (context: {
		count: number;
		points: number;
		user: AuthenticatedUser;
		ccas: CCAData[];
	}) => string | undefined;
};
