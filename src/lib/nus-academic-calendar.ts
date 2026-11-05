const DAY_MS = 86_400_000;

interface TeachingBlock {
	start: string;
	firstWeek: number;
	weeks: number;
}

/**
 * NUS AY2026/27 teaching periods.
 *
 * Each semester has Weeks 1-6, a recess week, then Weeks 7-13. Add the next
 * academic year's dates here when its calendar is published.
 */
const TEACHING_BLOCKS: TeachingBlock[] = [
	// Semester 1
	{ start: "2026-08-10", firstWeek: 1, weeks: 6 },
	{ start: "2026-09-28", firstWeek: 7, weeks: 7 },

	// Semester 2
	{ start: "2027-01-11", firstWeek: 1, weeks: 6 },
	{ start: "2027-03-01", firstWeek: 7, weeks: 7 },
];

export interface NusAcademicWeek {
	weekNumber: number;
	start: string;
	end: string;
	dates: string[];
}

function dateKeyToDayNumber(dateKey: string): number {
	const [year, month, day] = dateKey.split("-").map(Number);
	return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

export function addDays(dateKey: string, amount: number): string {
	const [year, month, day] = dateKey.split("-").map(Number);
	const date = new Date(Date.UTC(year, month - 1, day + amount));

	return [
		date.getUTCFullYear(),
		String(date.getUTCMonth() + 1).padStart(2, "0"),
		String(date.getUTCDate()).padStart(2, "0"),
	].join("-");
}

/** Today's YYYY-MM-DD date in Singapore, regardless of server timezone. */
export function getSingaporeDateKey(now: Date = new Date()): string {
	const parts = new Intl.DateTimeFormat("en-GB", {
		timeZone: "Asia/Singapore",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(now);

	const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	return `${values.year}-${values.month}-${values.day}`;
}

export function getNusWeekForDate(dateKey: string): NusAcademicWeek | null {
	const targetDay = dateKeyToDayNumber(dateKey);

	for (const block of TEACHING_BLOCKS) {
		const blockStart = dateKeyToDayNumber(block.start);
		const daysFromStart = targetDay - blockStart;
		const weekOffset = Math.floor(daysFromStart / 7);

		if (daysFromStart < 0 || weekOffset >= block.weeks) continue;

		const start = addDays(block.start, weekOffset * 7);

		return {
			weekNumber: block.firstWeek + weekOffset,
			start,
			end: addDays(start, 6),
			dates: Array.from({ length: 7 }, (_, index) => addDays(start, index)),
		};
	}

	return null;
}

export function getCurrentNusWeek(now: Date = new Date()): NusAcademicWeek | null {
	return getNusWeekForDate(getSingaporeDateKey(now));
}

/** Calendar weeks chairs can browse and request, counting the current week. */
export const BOOKING_WEEKS_AHEAD = 4;

/** The Monday on or before a YYYY-MM-DD date. */
export function getMondayOf(dateKey: string): string {
	const weekday = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
	return addDays(dateKey, -((weekday + 6) % 7));
}

/**
 * The teaching weeks open for booking: whichever of the next four calendar
 * weeks are teaching weeks. Recess and exam weeks stay closed, so this can hold
 * fewer than four weeks, or none during the vacation.
 */
export function getBookingWeeks(now: Date = new Date()): NusAcademicWeek[] {
	const monday = getMondayOf(getSingaporeDateKey(now));
	return Array.from({ length: BOOKING_WEEKS_AHEAD }, (_, index) =>
		getNusWeekForDate(addDays(monday, index * 7)),
	).filter((week): week is NusAcademicWeek => week !== null);
}

export function isWithinBookingWindow(dateKey: string, now: Date = new Date()): boolean {
	return getBookingWeeks(now).some((week) => dateKey >= week.start && dateKey <= week.end);
}

/** The current hour (0–23) in Singapore, regardless of server timezone. */
export function getSingaporeHour(now: Date = new Date()): number {
	const hour = new Intl.DateTimeFormat("en-GB", {
		timeZone: "Asia/Singapore",
		hour: "2-digit",
		hourCycle: "h23",
	}).format(now);
	return Number(hour);
}
