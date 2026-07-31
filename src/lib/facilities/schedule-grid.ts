import { FacilityType } from "@/types/facilities";

/** One booking_schedules row, flattened with its facility, for the weekly editor. */
export interface ScheduleSlot {
	id: number;
	facility_id: number;
	venue: string;
	sub_venue: string;
	type: FacilityType;
	day_of_week: number; // 0=Sun … 6=Sat
	hour: number; // 0–23
	start_date: string | null; // YYYY-MM-DD; null = unbounded
	end_date: string | null; // YYYY-MM-DD; null = unbounded
}

/** Grouping key fragment for a slot's date bounds, so differing ranges never merge. */
function boundsKey(s: ScheduleSlot): string {
	return `${s.start_date ?? ""}|${s.end_date ?? ""}`;
}

/** A run of adjacent hours for one facility on a given day. */
interface MergedBlock {
	day: number;
	startHour: number;
	endHour: number; // exclusive
	facility_id: number;
	venue: string;
	sub_venue: string;
}

/** All blocks sharing one (day, startHour, endHour). */
export interface Cluster {
	startHour: number;
	endHour: number;
	total: number;
	blocks: MergedBlock[];
}

interface DayColumn {
	day: number;
	clusters: Cluster[];
}

export interface WeekModel {
	days: DayColumn[]; // always length 7, day 0..6
}

function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V): void {
	const list = map.get(key);
	if (list) list.push(value);
	else map.set(key, [value]);
}

/** Merge each (day, facility, bounds) group's hours into contiguous runs. */
function mergeBlocks(slots: ScheduleSlot[]): MergedBlock[] {
	const groups = new Map<string, ScheduleSlot[]>();
	for (const s of slots) {
		pushTo(groups, `${s.day_of_week}|${s.facility_id}|${boundsKey(s)}`, s);
	}

	const out: MergedBlock[] = [];
	for (const group of groups.values()) {
		const hours = [...new Set(group.map((s) => s.hour))].sort((a, b) => a - b);
		const sample = group[0];
		let start = hours[0];
		let prev = hours[0];
		for (let i = 1; i <= hours.length; i++) {
			if (i < hours.length && hours[i] === prev + 1) {
				prev = hours[i];
				continue;
			}
			out.push({
				day: sample.day_of_week,
				startHour: start,
				endHour: prev + 1,
				facility_id: sample.facility_id,
				venue: sample.venue,
				sub_venue: sample.sub_venue,
			});
			if (i < hours.length) {
				start = hours[i];
				prev = hours[i];
			}
		}
	}
	return out;
}

/** A contiguous run of hours for one (facility, date range), with its row ids. */
export interface ScheduleWindow {
	facility_id: number;
	venue: string;
	sub_venue: string;
	start_date: string | null;
	end_date: string | null;
	startHour: number;
	endHour: number; // exclusive
	hours: number[];
	ids: number[];
}

/**
 * Collapse schedule rows into contiguous-hour windows, grouped by
 * (facility, date range). Each window keeps the underlying row ids so
 * callers can edit/delete the whole run. Sorted by start hour.
 */
export function mergeContiguous(slots: ScheduleSlot[]): ScheduleWindow[] {
	const groups = new Map<string, ScheduleSlot[]>();
	for (const s of slots) {
		pushTo(groups, `${s.facility_id}|${boundsKey(s)}`, s);
	}

	const out: ScheduleWindow[] = [];
	for (const group of groups.values()) {
		const byHour = new Map<number, ScheduleSlot[]>();
		for (const s of group) pushTo(byHour, s.hour, s);
		const hours = [...byHour.keys()].sort((a, b) => a - b);
		const sample = group[0];

		let runStart = hours[0];
		let prev = hours[0];
		let ids: number[] = [...byHour.get(hours[0])!.map((s) => s.id)];
		const flush = (endHourExclusive: number) => {
			const runHours: number[] = [];
			for (let h = runStart; h < endHourExclusive; h++) runHours.push(h);
			out.push({
				facility_id: sample.facility_id,
				venue: sample.venue,
				sub_venue: sample.sub_venue,
				start_date: sample.start_date,
				end_date: sample.end_date,
				startHour: runStart,
				endHour: endHourExclusive,
				hours: runHours,
				ids,
			});
		};

		for (let i = 1; i < hours.length; i++) {
			if (hours[i] === prev + 1) {
				prev = hours[i];
				ids = ids.concat(byHour.get(hours[i])!.map((s) => s.id));
				continue;
			}
			flush(prev + 1);
			runStart = hours[i];
			prev = hours[i];
			ids = [...byHour.get(hours[i])!.map((s) => s.id)];
		}
		flush(prev + 1);
	}

	return out.sort((a, b) => a.startHour - b.startHour);
}

export function buildWeek(slots: ScheduleSlot[]): WeekModel {
	const blocks = mergeBlocks(slots);

	const days: DayColumn[] = [];
	for (let day = 0; day <= 6; day++) {
		const byRange = new Map<string, MergedBlock[]>();
		for (const b of blocks) {
			if (b.day !== day) continue;
			pushTo(byRange, `${b.startHour}-${b.endHour}`, b);
		}

		const clusters: Cluster[] = [...byRange.values()]
			.map((group) => ({
				startHour: group[0].startHour,
				endHour: group[0].endHour,
				total: group.length,
				blocks: group,
			}))
			.sort((a, b) => a.startHour - b.startHour);

		days.push({ day, clusters });
	}

	return { days };
}
