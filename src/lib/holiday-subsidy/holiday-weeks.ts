import config from "@/config/holiday-weeks.json";

const SG_OFFSET = "+08:00";

export type HolidayWeek = {
	id: number;
	label: string;
	range: string;
	start: Date;
	endExclusive: Date;
};

function sgDate(dateStr: string): Date {
	return new Date(`${dateStr}T00:00:00${SG_OFFSET}`);
}

function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}

const rawWeeks = config.weeks;

export const HOLIDAY_WEEKS: HolidayWeek[] = rawWeeks.map((week, index) => {
	const startDate = sgDate(week.start);
	const nextRawStart = rawWeeks[index + 1]?.start;
	const endExclusive = nextRawStart ? sgDate(nextRawStart) : addDays(startDate, 7);
	return { id: week.id, label: week.label, range: week.range, start: startDate, endExclusive };
});

export const HOLIDAY_WEEK_OPTIONS = HOLIDAY_WEEKS.map((week) => ({
	id: week.id,
	label: `${week.label} (${week.range})`,
}));

function findCurrentWeekIndex(now: Date): number {
	return HOLIDAY_WEEKS.findIndex((week) => now >= week.start && now < week.endExclusive);
}

function getPreviousWeekLockDeadline(currentWeekIndex: number): Date | null {
	const currentWeekStart = HOLIDAY_WEEKS[currentWeekIndex]?.start;
	if (!currentWeekStart) return null;
	const deadline = new Date(currentWeekStart);
	deadline.setDate(deadline.getDate() + config.grace_days);
	deadline.setHours(23, 59, 59, 999);
	return deadline;
}

export function getEditableWeekIds(now = new Date()): number[] {
	const currentWeekIndex = findCurrentWeekIndex(now);
	if (currentWeekIndex === -1) return [];

	const editableWeeks = [HOLIDAY_WEEKS[currentWeekIndex].id];

	if (currentWeekIndex > 0) {
		const previousWeek = HOLIDAY_WEEKS[currentWeekIndex - 1];
		const lockDeadline = getPreviousWeekLockDeadline(currentWeekIndex);
		if (lockDeadline && now <= lockDeadline) {
			editableWeeks.push(previousWeek.id);
		}
	}

	return editableWeeks;
}

export function isWeekEditable(weekId: number, now = new Date()): boolean {
	return getEditableWeekIds(now).includes(weekId);
}

export function getWeekLabel(weekId: number): string | null {
	const week = HOLIDAY_WEEKS.find((w) => w.id === weekId);
	return week ? `${week.label} (${week.range})` : null;
}

/**
 * Translate a week id (UI/URL parameter) to the ISO "YYYY-MM-DD" SG-local
 * week-start date that `cca_subsidies.day` stores.
 *
 * Returns `null` when the week id is not known to the local config — callers
 * should map this to an explicit 400 ("Unknown week"). Treating it as a silent
 * lookup-miss masks typos in `holiday-weeks.json` per plan 05 §7 Q8.
 */
export function getWeekDay(weekId: number): string | null {
	const week = HOLIDAY_WEEKS.find((w) => w.id === weekId);
	if (!week) return null;
	// HOLIDAY_WEEK starts are constructed via `sgDate("YYYY-MM-DD")` which
	// produces `${date}T00:00:00+08:00`. The first 10 chars of the raw config
	// string are exactly what the DB stores; pull from the source-of-truth
	// rather than re-deriving via `toISOString().slice(0,10)` (which would
	// shift by 8h in UTC representation).
	return getWeekStartIso(week.start);
}

/**
 * Inverse of `getWeekDay`. Given the SG-local "YYYY-MM-DD" stored in
 * `cca_subsidies.day`, return the in-app week id.
 *
 * Returns `null` for dates that do not correspond to a configured week — the
 * route layer drops those rows (legacy entries / out-of-config dates).
 */
export function getWeekIdForDay(day: string): number | null {
	return HOLIDAY_WEEKS.find((w) => getWeekStartIso(w.start) === day)?.id ?? null;
}

function getWeekStartIso(start: Date): string {
	// HOLIDAY_WEEKS[i].start was built from `new Date("YYYY-MM-DDT00:00:00+08:00")`;
	// extract the SG-local "YYYY-MM-DD" by adding the SG offset and slicing the UTC ISO.
	// `start.getTime()` is the UTC epoch; `start + 8h` interpreted as UTC
	// is the same wall-clock as SG.
	const sgMillis = start.getTime() + 8 * 60 * 60 * 1000;
	return new Date(sgMillis).toISOString().slice(0, 10);
}
