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
	priority: number;
	reboks_activity: string | null;
}

/** A run of adjacent hours for one (facility, activity, priority) on a given day. */
export interface MergedBlock {
	day: number;
	startHour: number;
	endHour: number; // exclusive
	priority: number;
	facility_id: number;
	venue: string;
	sub_venue: string;
	reboks_activity: string | null;
}

/** Slots of one priority sharing a cluster's time-span. */
export interface WaveBucket {
	priority: number;
	count: number;
	blocks: MergedBlock[];
}

/** All blocks sharing one (day, startHour, endHour), grouped by wave. */
export interface Cluster {
	startHour: number;
	endHour: number;
	total: number;
	waves: WaveBucket[];
}

export interface DayColumn {
	day: number;
	clusters: Cluster[];
}

export interface WaveInfo {
	priority: number;
	wave: number; // 1-based rank (lower priority → lower wave number → fires first)
	color: string;
}

export interface WeekModel {
	days: DayColumn[]; // always length 7, day 0..6
	waves: WaveInfo[]; // distinct priorities, ascending
}

/** Sequential ramp: hottest (fires first) → coolest. Wraps deterministically. */
export const WAVE_PALETTE = [
	"#ef4444",
	"#f97316",
	"#eab308",
	"#22c55e",
	"#06b6d4",
	"#8b5cf6",
] as const;

export function waveColor(rank: number): string {
	const n = WAVE_PALETTE.length;
	return WAVE_PALETTE[((rank % n) + n) % n];
}

function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V): void {
	const list = map.get(key);
	if (list) list.push(value);
	else map.set(key, [value]);
}

/** Merge each (day, facility, activity, priority) group's hours into contiguous runs. */
function mergeBlocks(slots: ScheduleSlot[]): MergedBlock[] {
	const groups = new Map<string, ScheduleSlot[]>();
	for (const s of slots) {
		pushTo(groups, `${s.day_of_week}|${s.facility_id}|${s.reboks_activity ?? ""}|${s.priority}`, s);
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
				priority: sample.priority,
				facility_id: sample.facility_id,
				venue: sample.venue,
				sub_venue: sample.sub_venue,
				reboks_activity: sample.reboks_activity,
			});
			if (i < hours.length) {
				start = hours[i];
				prev = hours[i];
			}
		}
	}
	return out;
}

/** A contiguous run of hours for one (facility, activity, wave), with its row ids. */
export interface ScheduleWindow {
	facility_id: number;
	venue: string;
	sub_venue: string;
	priority: number;
	reboks_activity: string | null;
	startHour: number;
	endHour: number; // exclusive
	hours: number[];
	ids: number[];
}

/**
 * Collapse schedule rows into contiguous-hour windows, grouped by
 * (facility, activity, priority). Each window keeps the underlying row ids so
 * callers can edit/delete the whole run. Sorted by start hour.
 */
export function mergeContiguous(slots: ScheduleSlot[]): ScheduleWindow[] {
	const groups = new Map<string, ScheduleSlot[]>();
	for (const s of slots) {
		pushTo(groups, `${s.facility_id}|${s.reboks_activity ?? ""}|${s.priority}`, s);
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
				priority: sample.priority,
				reboks_activity: sample.reboks_activity,
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
	const priorities = [...new Set(slots.map((s) => s.priority))].sort((a, b) => a - b);
	const waves: WaveInfo[] = priorities.map((priority, i) => ({
		priority,
		wave: i + 1,
		color: waveColor(i),
	}));

	const blocks = mergeBlocks(slots);

	const days: DayColumn[] = [];
	for (let day = 0; day <= 6; day++) {
		const byRange = new Map<string, MergedBlock[]>();
		for (const b of blocks) {
			if (b.day !== day) continue;
			pushTo(byRange, `${b.startHour}-${b.endHour}`, b);
		}

		const clusters: Cluster[] = [...byRange.values()]
			.map((group) => {
				const byPriority = new Map<number, MergedBlock[]>();
				for (const b of group) pushTo(byPriority, b.priority, b);
				const waveBuckets: WaveBucket[] = [...byPriority.entries()]
					.sort((a, b) => a[0] - b[0])
					.map(([priority, bs]) => ({ priority, count: bs.length, blocks: bs }));
				return {
					startHour: group[0].startHour,
					endHour: group[0].endHour,
					total: group.length,
					waves: waveBuckets,
				};
			})
			.sort((a, b) => a.startHour - b.startHour);

		days.push({ day, clusters });
	}

	return { days, waves };
}
