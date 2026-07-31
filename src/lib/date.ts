// Helpers for the local-date strings ("YYYY-MM-DD") used across calendar UIs.
// `month` is always 0-based (JS Date convention).

export const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function getDaysInMonth(year: number, month: number): number {
	return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfMonth(year: number, month: number): number {
	return new Date(year, month, 1).getDay();
}

export function formatDateKey(year: number, month: number, day: number): string {
	return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getMonthLabel(year: number, month: number): string {
	return new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** First and last date keys of a month, for range-filtered API queries. */
export function getMonthRange(year: number, month: number): { start: string; end: string } {
	return {
		start: formatDateKey(year, month, 1),
		end: formatDateKey(year, month, getDaysInMonth(year, month)),
	};
}

export function todayKey(): string {
	return new Date().toISOString().split("T")[0];
}

const DISPLAY_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
	weekday: "long",
	month: "long",
	day: "numeric",
};

/** "2026-07-04" → "Saturday, July 4" (or per `opts` when provided). */
export function formatDisplayDate(dateStr: string, opts?: Intl.DateTimeFormatOptions): string {
	return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
		...DISPLAY_DATE_OPTIONS,
		...opts,
	});
}
