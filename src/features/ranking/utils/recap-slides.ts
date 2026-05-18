import type { CCAData } from "@/features/cca/types/cca-data";
import type {
	RecapCategoryConfig,
	RecapData,
	RecapSlide,
	RecapTotals,
} from "@/features/ranking/types/recap";
import { isResidentPositionType } from "@/features/ranking/utils/cca-ranking-metrics";
import type { User } from "@/types/User";

const leadershipPositionTypes = new Set(["lead", "vice", "maincomm", "subcomm"]);
const ihgTeamStatuses = new Set(["ihg-team", "ivp-ihg-team"]);

function formatCount(count: number, singular: string, plural = `${singular}s`) {
	return `${count} ${count === 1 ? singular : plural}`;
}

function isLeadershipRole(cca: Pick<CCAData, "position_type" | "role">) {
	const positionType = String(cca.position_type || "")
		.trim()
		.toLowerCase();
	const role = String(cca.role || "")
		.trim()
		.toLowerCase();

	return (
		leadershipPositionTypes.has(positionType) || role.includes("lead") || role.includes("vice")
	);
}

function truncateList(values: string[], maxVisible = 3) {
	const filtered = values.filter(Boolean);
	if (filtered.length <= maxVisible) return filtered;

	const visible = filtered.slice(0, maxVisible);
	const remaining = filtered.length - maxVisible;
	return [...visible, `${remaining} more`];
}

function isBlockCcaName(value?: string | null) {
	return String(value || "")
		.trim()
		.toLowerCase()
		.startsWith("block");
}

function isResidentBlockPosition(positionType?: string | null, role?: string | null) {
	return (
		isResidentPositionType(positionType) ||
		String(role || "")
			.trim()
			.toLowerCase() === "resident"
	);
}

export const RECAP_CATEGORY_CONFIG: RecapCategoryConfig[] = [
	{
		id: "culture",
		eyebrow: "Culture",
		title: "How cultural were you this year?",
		descriptionWhenPresent: ({ count }) => `You joined ${formatCount(count, "culture CCA")}.`,
		descriptionWhenEmpty: "This part of your year stayed in the background.",
		statLabel: "Points so far",
		accent: "from-[#2b124c] via-[#ff4d8d] to-[#ff9f43]",
		filter: (cca) => cca.cca_type === "culture",
		buildSupportingText: () => "All your trainings, concerts, practices led to this.",
	},
	{
		id: "sports",
		eyebrow: "Activity",
		title: "How physically active were you in Sheares?",
		descriptionWhenPresent: ({ count }) => `You joined ${formatCount(count, "sport CCA")}.`,
		descriptionWhenEmpty: "Perhaps your energy showed up somewhere else this year?",
		statLabel: "Points so far",
		accent: "from-[#10203f] via-[#1e90ff] to-[#00c6ff]",
		filter: (cca) => cca.cca_type === "sports",
		buildSupportingText: () => "Sheares Hall Sports Hall??",
	},
	{
		id: "committees",
		eyebrow: "Committees",
		title: "So.. do you like to plan events?",
		descriptionWhenPresent: ({ count }) =>
			`You joined ${formatCount(count, "committee", "committees")} in total.`,
		descriptionWhenEmpty: "You stayed fairly quiet this year.",
		statLabel: "Points so far",
		accent: "from-[#35155d] via-[#c94b4b] to-[#f2994a]",
		filter: (cca) => {
			if (cca.cca_type !== "committee") return false;
			const posType = String(cca.position_type || "")
				.trim()
				.toLowerCase();
			return posType !== "member" && posType !== "resident";
		},
		buildSupportingText: () => undefined,
	},
	{
		id: "block",
		eyebrow: "Block",
		title: "Are you active in your block?",
		descriptionWhenPresent: () => "Block points also contributed to your total.",
		descriptionWhenEmpty: "No block points showed up here.",
		statLabel: "Points so far",
		accent: "from-[#0f172a] via-[#1e3a8a] to-[#3b82f6]",
		filter: (cca) =>
			isBlockCcaName(cca.name) && isResidentBlockPosition(cca.position_type, cca.role),
		buildSupportingText: ({ points }) => (points > 0 ? "Home ground matters too." : undefined),
	},
	{
		id: "supplementary",
		eyebrow: "Supplementary",
		title: "You also participated in some events!",
		descriptionWhenPresent: () => "Some extra points quietly slipped into your pocket too.",
		descriptionWhenEmpty: "No supplementary points showed up this time.",
		statLabel: "Points so far",
		accent: "from-[#064e3b] via-[#166534] to-[#10b981]",
		filter: (cca) => cca.cca_type === "supplementary",
		buildSupportingText: ({ points }) =>
			points > 0 ? "Small additions still make the total feel very different." : undefined,
	},
	{
		id: "adhoc",
		eyebrow: "Adhoc Events",
		title: "There were some adhoc events too",
		descriptionWhenPresent: () => "You joined them and snagged some extra points.",
		descriptionWhenEmpty: "Did you join them?",
		statLabel: "Points so far",
		accent: "from-[#4c1d95] via-[#7e22ce] to-[#c084fc]",
		filter: (cca) => cca.cca_type === "adhoc",
		buildSupportingText: ({ points }) => (points > 0 ? "Every little event counts." : undefined),
	},
];

export function buildRecapSlides(user: User, ccas: CCAData[]): RecapData {
	const totalPoints = user.points || 0;
	const totalCcas = ccas.length;
	const cultureCcas = ccas.filter(RECAP_CATEGORY_CONFIG[0].filter);
	const sportsCcas = ccas.filter(RECAP_CATEGORY_CONFIG[1].filter);
	const committeeCcas = ccas.filter(RECAP_CATEGORY_CONFIG[2].filter);
	const supplementaryCcas = ccas.filter(RECAP_CATEGORY_CONFIG[4].filter);
	const adhocCcas = ccas.filter(RECAP_CATEGORY_CONFIG[5].filter);
	const blockResidentAppointments = (user.appointments || []).filter(
		(appointment) =>
			isBlockCcaName(appointment.cca_name) &&
			isResidentBlockPosition(appointment.position_type, appointment.position_name),
	);
	const leadershipCcas = committeeCcas.filter(isLeadershipRole);

	const culturePoints = cultureCcas.reduce((sum, cca) => sum + (cca.points || 0), 0);
	const sportsPoints = sportsCcas.reduce((sum, cca) => sum + (cca.points || 0), 0);
	const committeePoints = committeeCcas.reduce((sum, cca) => sum + (cca.points || 0), 0);
	const supplementaryPoints = supplementaryCcas.reduce((sum, cca) => sum + (cca.points || 0), 0);
	const adhocPoints = adhocCcas.reduce((sum, cca) => sum + (cca.points || 0), 0);
	const blockPoints = blockResidentAppointments.reduce(
		(sum, appointment) => sum + (appointment.points || 0),
		0,
	);

	const cumulativeAfterCulture = culturePoints;
	const cumulativeAfterSports = cumulativeAfterCulture + sportsPoints;
	const cumulativeAfterCommittees = cumulativeAfterSports + committeePoints;
	const cumulativeAfterBlock = cumulativeAfterCommittees + blockPoints;
	const cumulativeAfterSupplementary = cumulativeAfterBlock + supplementaryPoints;
	const cumulativeAfterAdhoc = cumulativeAfterSupplementary + adhocPoints;
	const sportsIhgTeamCount = sportsCcas.filter((cca) =>
		ihgTeamStatuses.has(
			String(cca.cut_status || "")
				.trim()
				.toLowerCase(),
		),
	).length;

	const committeeNames = truncateList(committeeCcas.map((cca) => cca.name));
	const sportsNames = truncateList(sportsCcas.map((cca) => cca.name));
	const cultureNames = truncateList(cultureCcas.map((cca) => cca.name));
	const supplementaryNames = truncateList(supplementaryCcas.map((cca) => cca.name));
	const adhocNames = truncateList(adhocCcas.map((cca) => cca.name));
	const blockResidentNames = truncateList(
		blockResidentAppointments.map((appointment) => appointment.cca_name),
	);
	const leadershipDescriptions = truncateList(
		leadershipCcas.map((cca) => `${cca.role} in ${cca.name}`),
		2,
	);

	const totals: RecapTotals = {
		totalPoints,
		totalCcas,
		culturePoints,
		sportsPoints,
		committeePoints,
		blockPoints,
		supplementaryPoints,
		adhocPoints,
	};

	const slides: RecapSlide[] = [
		{
			id: "intro",
			eyebrow: "Points Recap",
			title: "How did you earn points?",
			description: "Before the final reveal, let’s trace how your AY25/26 took shape.",
			statLabel: "Points so far",
			statValue: "0",
			statNote: `You were in ${formatCount(totalCcas, "CCA")} this year`,
			supportingText: "Watch this number climb as each cca adds to your final points.",
			accent: "from-[#2a1458] via-[#7b2ff7] to-[#ff5ea8]",
		},
		{
			id: "culture",
			eyebrow: RECAP_CATEGORY_CONFIG[0].eyebrow,
			title: RECAP_CATEGORY_CONFIG[0].title,
			description:
				cultureCcas.length > 0
					? RECAP_CATEGORY_CONFIG[0].descriptionWhenPresent({
							count: cultureCcas.length,
							points: culturePoints,
							user,
							ccas,
						})
					: RECAP_CATEGORY_CONFIG[0].descriptionWhenEmpty,
			statLabel: RECAP_CATEGORY_CONFIG[0].statLabel,
			statValue: String(cumulativeAfterCulture),
			statNote:
				culturePoints > 0
					? `${culturePoints} point${culturePoints === 1 ? "" : "s"} came from the cultures.`
					: cultureCcas.length > 0
						? "The colour was there, even if the scoreboard stayed quiet :("
						: undefined,
			bulletItems: cultureCcas.length > 0 ? cultureNames : undefined,
			supportingText: RECAP_CATEGORY_CONFIG[0].buildSupportingText({
				count: cultureCcas.length,
				points: culturePoints,
				user,
				ccas,
			}),
			accent: RECAP_CATEGORY_CONFIG[0].accent,
		},
		{
			id: "sports",
			eyebrow: RECAP_CATEGORY_CONFIG[1].eyebrow,
			title: RECAP_CATEGORY_CONFIG[1].title,
			description:
				sportsCcas.length > 0
					? RECAP_CATEGORY_CONFIG[1].descriptionWhenPresent({
							count: sportsCcas.length,
							points: sportsPoints,
							user,
							ccas,
						})
					: RECAP_CATEGORY_CONFIG[1].descriptionWhenEmpty,
			statLabel: RECAP_CATEGORY_CONFIG[1].statLabel,
			statValue: String(cumulativeAfterSports),
			statNote:
				sportsIhgTeamCount > 0
					? `You represented Sheares Hall in IHG in ${sportsIhgTeamCount} sports.`
					: sportsCcas.length > 0
						? `${sportsPoints} point${sportsPoints === 1 ? "" : "s"} came from sports.`
						: undefined,
			bulletItems: sportsCcas.length > 0 ? sportsNames : undefined,
			supportingText: RECAP_CATEGORY_CONFIG[1].buildSupportingText({
				count: sportsCcas.length,
				points: sportsPoints,
				user,
				ccas,
			}),
			accent: RECAP_CATEGORY_CONFIG[1].accent,
		},
		{
			id: "committees",
			eyebrow: RECAP_CATEGORY_CONFIG[2].eyebrow,
			title: RECAP_CATEGORY_CONFIG[2].title,
			description:
				committeeCcas.length > 0
					? RECAP_CATEGORY_CONFIG[2].descriptionWhenPresent({
							count: committeeCcas.length,
							points: committeePoints,
							user,
							ccas,
						})
					: RECAP_CATEGORY_CONFIG[2].descriptionWhenEmpty,
			statLabel: RECAP_CATEGORY_CONFIG[2].statLabel,
			statValue: String(cumulativeAfterCommittees),
			statNote:
				committeePoints > 0
					? `${committeePoints} point${committeePoints === 1 ? "" : "s"} came from the work of building and shaping hall life.`
					: committeeCcas.length > 0
						? "The effort was there even if the points have not landed yet."
						: undefined,
			bulletItems: committeeCcas.length > 0 ? committeeNames : undefined,
			supportingText:
				leadershipDescriptions.length > 0
					? `You also took on ${formatCount(leadershipCcas.length, "leadership position")}.`
					: committeeCcas.length > 0
						? "No leadership roles here, but you still did the work."
						: RECAP_CATEGORY_CONFIG[2].buildSupportingText({
								count: committeeCcas.length,
								points: committeePoints,
								user,
								ccas,
							}),
			supportingBulletItems: leadershipDescriptions.length > 0 ? leadershipDescriptions : undefined,
			accent: RECAP_CATEGORY_CONFIG[2].accent,
		},
		{
			id: "block",
			eyebrow: RECAP_CATEGORY_CONFIG[3].eyebrow,
			title: RECAP_CATEGORY_CONFIG[3].title,
			description:
				blockResidentAppointments.length > 0
					? RECAP_CATEGORY_CONFIG[3].descriptionWhenPresent({
							count: blockResidentAppointments.length,
							points: blockPoints,
							user,
							ccas,
						})
					: RECAP_CATEGORY_CONFIG[3].descriptionWhenEmpty,
			statLabel: RECAP_CATEGORY_CONFIG[3].statLabel,
			statValue: String(cumulativeAfterBlock),
			statNote:
				blockPoints > 0
					? `${blockPoints} block point${blockPoints === 1 ? "" : "s"} came in here.`
					: undefined,
			bulletItems: blockResidentNames.length > 0 ? blockResidentNames : undefined,
			supportingText: RECAP_CATEGORY_CONFIG[3].buildSupportingText({
				count: blockResidentAppointments.length,
				points: blockPoints,
				user,
				ccas,
			}),
			accent: RECAP_CATEGORY_CONFIG[3].accent,
		},
		{
			id: "supplementary",
			eyebrow: RECAP_CATEGORY_CONFIG[4].eyebrow,
			title: RECAP_CATEGORY_CONFIG[4].title,
			description:
				supplementaryCcas.length > 0
					? RECAP_CATEGORY_CONFIG[4].descriptionWhenPresent({
							count: supplementaryCcas.length,
							points: supplementaryPoints,
							user,
							ccas,
						})
					: RECAP_CATEGORY_CONFIG[4].descriptionWhenEmpty,
			statLabel: RECAP_CATEGORY_CONFIG[4].statLabel,
			statValue: String(cumulativeAfterSupplementary),
			statNote:
				supplementaryPoints > 0
					? `${supplementaryPoints} supplementary point${supplementaryPoints === 1 ? "" : "s"} came in here.`
					: undefined,
			bulletItems: supplementaryNames.length > 0 ? supplementaryNames : undefined,
			supportingText: RECAP_CATEGORY_CONFIG[4].buildSupportingText({
				count: supplementaryCcas.length,
				points: supplementaryPoints,
				user,
				ccas,
			}),
			accent: RECAP_CATEGORY_CONFIG[4].accent,
		},
		{
			id: "adhoc",
			eyebrow: RECAP_CATEGORY_CONFIG[5].eyebrow,
			title: RECAP_CATEGORY_CONFIG[5].title,
			description:
				adhocCcas.length > 0
					? RECAP_CATEGORY_CONFIG[5].descriptionWhenPresent({
							count: adhocCcas.length,
							points: adhocPoints,
							user,
							ccas,
						})
					: RECAP_CATEGORY_CONFIG[5].descriptionWhenEmpty,
			statLabel: RECAP_CATEGORY_CONFIG[5].statLabel,
			statValue: String(cumulativeAfterAdhoc),
			statNote:
				adhocPoints > 0
					? `${adhocPoints} adhoc point${adhocPoints === 1 ? "" : "s"} came in here.`
					: undefined,
			bulletItems: adhocNames.length > 0 ? adhocNames : undefined,
			supportingText: RECAP_CATEGORY_CONFIG[5].buildSupportingText({
				count: adhocCcas.length,
				points: adhocPoints,
				user,
				ccas,
			}),
			accent: RECAP_CATEGORY_CONFIG[5].accent,
		},
		{
			id: "reveal",
			eyebrow: "Final Score",
			title: "Your Final Hall Points",
			description: "This is where your hall points stand at.",
			statLabel: "Total points",
			statValue: String(totalPoints),
			statNote: "Did you beat your friends? Share your statistics on LinkedIn.",
			emphasis: String(totalPoints),
			supportingText:
				totalCcas > 0 ? `${formatCount(totalCcas, "CCA")} joined.` : "No CCAs joined yet.",
			accent: "from-[#ff6a00] via-[#ff9500] to-[#ffb700]",
			kind: "reveal",
		},
	];

	return { slides, totals };
}
