const SG_OFFSET = "+08:00";

export type HolidayWeek = {
    id: number;
    label: string;
    range: string;
    start: Date;
    endExclusive: Date;
};

function sgDate(date: string) {
    return new Date(`${date}T00:00:00${SG_OFFSET}`);
}

function addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

const HOLIDAY_WEEK_DEFS = [
    { id: 6, label: "Week (Testing)", range: "1 Dec - 8 Dec", start: sgDate("2025-12-01") },
    { id: 1, label: "Week 1", range: "8 Dec - 14 Dec", start: sgDate("2025-12-08") },
    { id: 2, label: "Week 2", range: "15 Dec - 21 Dec", start: sgDate("2025-12-15") },
    { id: 3, label: "Week 3", range: "22 Dec - 28 Dec", start: sgDate("2025-12-22") },
    { id: 4, label: "Week 4", range: "29 Dec - 4 Jan", start: sgDate("2025-12-29") },
    { id: 5, label: "Week 5", range: "5 Jan - 11 Jan", start: sgDate("2026-01-05") },
] as const;

export const HOLIDAY_WEEKS: HolidayWeek[] = HOLIDAY_WEEK_DEFS.map((week, index) => {
    const nextStart = HOLIDAY_WEEK_DEFS[index + 1]?.start;
    const endExclusive = nextStart ? new Date(nextStart) : addDays(week.start, 7);

    return {
        ...week,
        start: new Date(week.start),
        endExclusive,
    } satisfies HolidayWeek;
});

export const HOLIDAY_WEEK_OPTIONS = HOLIDAY_WEEKS.map((week) => ({
    id: week.id,
    label: `${week.label} (${week.range})`,
}));

function findCurrentWeekIndex(now = new Date()): number {
    return HOLIDAY_WEEKS.findIndex((week) => now >= week.start && now < week.endExclusive);
}

function getPreviousWeekLockDeadline(currentWeekIndex: number) {
    const currentWeekStart = HOLIDAY_WEEKS[currentWeekIndex]?.start;
    if (!currentWeekStart) return null;

    const deadline = new Date(currentWeekStart);
    deadline.setDate(deadline.getDate() + 2); // Tuesday of the current week
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
