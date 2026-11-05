import { getSingaporeDateKey } from "@/lib/nus-academic-calendar";
import { ClaimStatus, Facility } from "@/types/facilities";

/**
 * The booking day runs 8 AM through to 2 AM. Hours 0 and 1 belong to the date
 * they are stored against but display after 11 PM, under a "next day" marker.
 */
export const GRID_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1];
export const GRID_SLOT_COUNT = GRID_HOURS.length;
/** First column that falls on the next calendar day (12 AM). */
export const NEXT_DAY_COLUMN = 16;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 86_400_000;

function periodOf(hour: number): "AM" | "PM" {
	return hour >= 12 ? "PM" : "AM";
}

function twelveHour(hour: number): number {
	return hour % 12 || 12;
}

export function formatClock(hour: number): string {
	return `${twelveHour(hour)} ${periodOf(hour)}`;
}

/** "8a", "12p": the availability editor's narrow column headers. */
export function formatShortHour(hour: number): string {
	return `${twelveHour(hour)}${hour >= 12 ? "p" : "a"}`;
}

/** The grid column for a stored hour, or -1 outside the booking day. */
export function columnOfHour(hour: number): number {
	return GRID_HOURS.indexOf(hour);
}

/** Label for columns [start, end): "6–9 PM", or "11 AM – 1 PM" across periods. */
export function formatHourSpan(start: number, end: number): string {
	const from = GRID_HOURS[start];
	const to = (GRID_HOURS[end - 1] + 1) % 24;
	return periodOf(from) === periodOf(to) && from < to
		? `${twelveHour(from)}–${twelveHour(to)} ${periodOf(to)}`
		: `${formatClock(from)} – ${formatClock(to)}`;
}

export function formatDuration(hours: number): string {
	return hours === 1 ? "1 hour" : `${hours} hours`;
}

function dateParts(dateKey: string) {
	const date = new Date(`${dateKey}T00:00:00Z`);
	return {
		weekday: WEEKDAYS[date.getUTCDay()],
		day: date.getUTCDate(),
		month: MONTHS[date.getUTCMonth()],
	};
}

export function weekdayLabel(dateKey: string): string {
	return dateParts(dateKey).weekday;
}

export function dayOfMonth(dateKey: string): number {
	return dateParts(dateKey).day;
}

/** "Wed 4 Nov" */
export function formatDayLabel(dateKey: string): string {
	const { weekday, day, month } = dateParts(dateKey);
	return `${weekday} ${day} ${month}`;
}

/** "2 – 8 Nov", or "26 Oct – 1 Nov" across months. */
export function formatWeekRange(start: string, end: string): string {
	const a = dateParts(start);
	const b = dateParts(end);
	return a.month === b.month
		? `${a.day} – ${b.day} ${b.month}`
		: `${a.day} ${a.month} – ${b.day} ${b.month}`;
}

function daysBetween(from: string, to: string): number {
	return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** "Today", "Tomorrow" or "In 5 days" for a request's date. */
export function relativeDayLabel(dateKey: string, today: string): string {
	const days = daysBetween(today, dateKey);
	if (days <= 0) return "Today";
	return days === 1 ? "Tomorrow" : `In ${days} days`;
}

/** "Requested yesterday", from a claim's created_at. */
export function formatRequestedAgo(requestedAt: string | null, today: string): string {
	if (!requestedAt) return "Requested";
	const days = daysBetween(getSingaporeDateKey(new Date(requestedAt)), today);
	if (days <= 0) return "Requested today";
	return days === 1 ? "Requested yesterday" : `Requested ${days} days ago`;
}

/** "MPSH Court 1", or just "Band Room" when the sub-venue already says it. */
export function facilityLabel(facility: Pick<Facility, "venue" | "sub_venue">): string {
	const name = facility.sub_venue || facility.venue;
	return name.startsWith(facility.venue) ? name : `${facility.venue} ${name}`;
}

/** Whether a grid column on a date is already over. The current hour still counts as open. */
export function isSlotPast(
	dateKey: string,
	column: number,
	today: string,
	currentHour: number,
): boolean {
	if (dateKey !== today) return dateKey < today;
	// Before 8 AM today's booking day has not begun, so nothing on it has passed.
	const currentColumn = currentHour >= 8 ? currentHour - 8 : -1;
	return column < currentColumn;
}

export interface GridClaim {
	claim_id: number;
	facility_id: number;
	date: string;
	hour: number;
	cca_id: number;
	cca_name: string;
	status: ClaimStatus;
}

/** A run of consecutive hours one CCA holds: what a person calls "a booking". */
export interface ClaimSegment<T extends GridClaim = GridClaim> {
	facility_id: number;
	date: string;
	cca_id: number;
	cca_name: string;
	status: ClaimStatus;
	/** Grid columns [start, end). */
	start: number;
	end: number;
	claims: T[];
	claim_ids: number[];
}

/**
 * Merge hourly claims into bookings. Claims are stored one per hour, but people
 * ask for and decide on "6–9 PM", so every list and grid block uses this.
 */
export function groupClaimSegments<T extends GridClaim>(claims: T[]): ClaimSegment<T>[] {
	const groups = new Map<string, { column: number; claim: T }[]>();
	for (const claim of claims) {
		const column = columnOfHour(claim.hour);
		if (column < 0) continue;
		const key = `${claim.facility_id}|${claim.date}|${claim.cca_id}|${claim.status}`;
		const group = groups.get(key) ?? [];
		group.push({ column, claim });
		groups.set(key, group);
	}

	const segments: ClaimSegment<T>[] = [];
	for (const group of groups.values()) {
		group.sort((a, b) => a.column - b.column);
		let current: ClaimSegment<T> | null = null;
		for (const { column, claim } of group) {
			if (current && column === current.end) {
				current.end = column + 1;
				current.claims.push(claim);
				current.claim_ids.push(claim.claim_id);
			} else {
				current = {
					facility_id: claim.facility_id,
					date: claim.date,
					cca_id: claim.cca_id,
					cca_name: claim.cca_name,
					status: claim.status,
					start: column,
					end: column + 1,
					claims: [claim],
					claim_ids: [claim.claim_id],
				};
				segments.push(current);
			}
		}
	}
	return segments;
}

export interface RequestCluster<T extends GridClaim> {
	facility_id: number;
	date: string;
	start: number;
	end: number;
	items: ClaimSegment<T>[];
}

/**
 * Group requests whose hours overlap on one venue and day. A cluster with more
 * than one item is a conflict JCRC has to decide; the rest are uncontested.
 */
export function clusterRequests<T extends GridClaim>(
	segments: ClaimSegment<T>[],
): RequestCluster<T>[] {
	const sorted = [...segments].sort(
		(a, b) => a.date.localeCompare(b.date) || a.facility_id - b.facility_id || a.start - b.start,
	);
	const clusters: RequestCluster<T>[] = [];
	for (const segment of sorted) {
		const last = clusters[clusters.length - 1];
		if (
			last &&
			last.date === segment.date &&
			last.facility_id === segment.facility_id &&
			segment.start < last.end
		) {
			last.items.push(segment);
			last.end = Math.max(last.end, segment.end);
		} else {
			clusters.push({
				facility_id: segment.facility_id,
				date: segment.date,
				start: segment.start,
				end: segment.end,
				items: [segment],
			});
		}
	}
	return clusters.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
}

/** Group column numbers into consecutive [start, end) runs. */
export function columnRuns(columns: number[]): [number, number][] {
	const runs: [number, number][] = [];
	for (const column of [...columns].sort((a, b) => a - b)) {
		const last = runs[runs.length - 1];
		if (last && last[1] === column) last[1] = column + 1;
		else runs.push([column, column + 1]);
	}
	return runs;
}
