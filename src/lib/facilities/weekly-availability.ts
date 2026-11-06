import {
	GRID_HOURS,
	GRID_SLOT_COUNT,
	columnOfHour,
	columnRuns,
	formatHourSpan,
} from "@/lib/facilities/booking-grid";
import { FacilitySchedule } from "@/types/facilities";

/** One recurring hour: `day` is the DB weekday (0=Sun), `hour` is 0–23. */
export interface ScheduleCell {
	day: number;
	hour: number;
}

/** Monday-first rows × grid-hour columns, as the availability editor paints it. */
export type WeekGrid = boolean[][];

export const WEEK_ROW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function weekdayToRow(day: number): number {
	return (day + 6) % 7;
}

function rowToWeekday(row: number): number {
	return (row + 1) % 7;
}

export function emptyWeekGrid(): WeekGrid {
	return WEEK_ROW_LABELS.map(() => Array<boolean>(GRID_SLOT_COUNT).fill(false));
}

/**
 * A venue is hidden when it still has hours but all of them were end-dated in
 * the past. That is how the Book toggle stores "hidden" without losing them.
 */
export function isFacilityHidden(schedules: FacilitySchedule[], today: string): boolean {
	return (
		schedules.length > 0 &&
		schedules.every((schedule) => schedule.end_date !== null && schedule.end_date < today)
	);
}

export function weekGridFromSchedules(schedules: FacilitySchedule[], today: string): WeekGrid {
	const grid = emptyWeekGrid();
	const hidden = isFacilityHidden(schedules, today);

	for (const schedule of schedules) {
		const expired = schedule.end_date !== null && schedule.end_date < today;
		if (expired && !hidden) continue;
		const column = columnOfHour(schedule.hour);
		if (column >= 0) grid[weekdayToRow(schedule.day_of_week)][column] = true;
	}
	return grid;
}

export function cellsFromWeekGrid(grid: WeekGrid): ScheduleCell[] {
	return grid.flatMap((row, rowIndex) =>
		row.flatMap((open, column) =>
			open ? [{ day: rowToWeekday(rowIndex), hour: GRID_HOURS[column] }] : [],
		),
	);
}

/** "4–10 PM, 11 PM – 2 AM" for one row; empty when the day is closed. */
export function summarizeRow(row: boolean[]): string {
	const openColumns = row.flatMap((open, column) => (open ? [column] : []));
	return columnRuns(openColumns)
		.map(([start, end]) => formatHourSpan(start, end))
		.join(", ");
}

/** "Mon–Fri 4–10 PM · Sat 8 AM – 2 PM", collapsing runs of identical days. */
export function summarizeWeek(grid: WeekGrid): string {
	const parts: string[] = [];
	let row = 0;
	while (row < grid.length) {
		const text = summarizeRow(grid[row]);
		let last = row;
		while (last + 1 < grid.length && summarizeRow(grid[last + 1]) === text) last++;
		if (text) {
			const days =
				row === last ? WEEK_ROW_LABELS[row] : `${WEEK_ROW_LABELS[row]}–${WEEK_ROW_LABELS[last]}`;
			parts.push(`${days} ${text}`);
		}
		row = last + 1;
	}
	return parts.join(" · ") || "No hours set";
}
