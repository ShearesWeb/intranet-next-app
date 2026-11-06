const DAY_MS = 86_400_000;

interface AcademicBlock {
	/** The Monday this block starts on. */
	start: string;
	weeks: number;
	label: (weekIndex: number) => string;
}

const teachingWeeks = (firstWeek: number) => (weekIndex: number) => `Week ${firstWeek + weekIndex}`;
const recessWeek = () => "Recess Week";
const readingWeek = () => "Reading Week";
const examWeeks = (weekIndex: number) => `Exam Week ${weekIndex + 1}`;

/**
 * NUS AY2026/27, in Monday-to-Sunday weeks.
 *
 * Each semester has Weeks 1-6, a recess week, Weeks 7-13, a reading week and two
 * exam weeks. Only the vacation is left out. Add the next academic year's dates
 * here when its calendar is published.
 */
const ACADEMIC_BLOCKS: AcademicBlock[] = [
	// Semester 1
	{ start: "2026-08-10", weeks: 6, label: teachingWeeks(1) },
	{ start: "2026-09-21", weeks: 1, label: recessWeek },
	{ start: "2026-09-28", weeks: 7, label: teachingWeeks(7) },
	{ start: "2026-11-16", weeks: 1, label: readingWeek },
	{ start: "2026-11-23", weeks: 2, label: examWeeks },

	// Semester 2
	{ start: "2027-01-11", weeks: 6, label: teachingWeeks(1) },
	{ start: "2027-02-22", weeks: 1, label: recessWeek },
	{ start: "2027-03-01", weeks: 7, label: teachingWeeks(7) },
	{ start: "2027-04-19", weeks: 1, label: readingWeek },
	{ start: "2027-04-26", weeks: 2, label: examWeeks },
];

export interface NusAcademicWeek {
	/** "Week 8", "Recess Week", "Reading Week" or "Exam Week 1". */
	label: string;
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

const SINGAPORE_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
	timeZone: "Asia/Singapore",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

/** Today's YYYY-MM-DD date in Singapore, regardless of server timezone. */
export function getSingaporeDateKey(now: Date = new Date()): string {
	const parts = SINGAPORE_DATE_FORMAT.formatToParts(now);

	const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	return `${values.year}-${values.month}-${values.day}`;
}

export function getNusWeekForDate(dateKey: string): NusAcademicWeek | null {
	const targetDay = dateKeyToDayNumber(dateKey);

	for (const block of ACADEMIC_BLOCKS) {
		const blockStart = dateKeyToDayNumber(block.start);
		const daysFromStart = targetDay - blockStart;
		const weekOffset = Math.floor(daysFromStart / 7);

		if (daysFromStart < 0 || weekOffset >= block.weeks) continue;

		const start = addDays(block.start, weekOffset * 7);

		return {
			label: block.label(weekOffset),
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
 * The weeks open for booking: whichever of the next four calendar weeks fall in
 * the semester, from Week 1 through exams. This can hold fewer than four weeks
 * near the vacation, or none during it.
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

const SINGAPORE_HOUR_FORMAT = new Intl.DateTimeFormat("en-GB", {
	timeZone: "Asia/Singapore",
	hour: "2-digit",
	hourCycle: "h23",
});

/** The current hour (0–23) in Singapore, regardless of server timezone. */
export function getSingaporeHour(now: Date = new Date()): number {
	return Number(SINGAPORE_HOUR_FORMAT.format(now));
}
