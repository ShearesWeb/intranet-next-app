import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ScheduleWeek } from "@/components/facilities/schedule-week";
import type { ScheduleSlot } from "@/lib/facilities/schedule-grid";

function slot(p: Partial<ScheduleSlot>): ScheduleSlot {
	return {
		id: p.id ?? 1,
		facility_id: p.facility_id ?? 1,
		venue: p.venue ?? "Venue",
		sub_venue: p.sub_venue ?? "Court",
		type: p.type ?? "reboks",
		day_of_week: p.day_of_week ?? 1,
		hour: p.hour ?? 19,
		priority: p.priority ?? 0,
		reboks_activity: p.reboks_activity ?? null,
	};
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

describe("ScheduleWeek", () => {
	it("renders 7 day columns", () => {
		act(() => root.render(<ScheduleWeek schedules={[]} />));
		expect(container.querySelectorAll('[data-testid="day-col"]')).toHaveLength(7);
	});

	it("renders a wave chip with the slot count in the right day column", () => {
		const slots = [
			slot({ facility_id: 1, day_of_week: 1, hour: 19, priority: 0 }),
			slot({ facility_id: 2, day_of_week: 1, hour: 19, priority: 0 }),
		];
		act(() => root.render(<ScheduleWeek schedules={slots} />));

		const mon = container.querySelector('[data-day="1"]') as HTMLElement;
		expect(mon).toBeTruthy();
		const chip = mon.querySelector('[data-testid="wave-chip"]') as HTMLElement;
		expect(chip).toBeTruthy();
		expect(chip.textContent).toContain("2"); // count
	});

	it("calls onSelectCluster when a cluster is clicked", () => {
		let picked: { day: number; startHour: number } | null = null;
		const slots = [slot({ day_of_week: 1, hour: 19, priority: 0 })];
		act(() =>
			root.render(
				<ScheduleWeek
					schedules={slots}
					onSelectCluster={(day, cluster) => {
						picked = { day, startHour: cluster.startHour };
					}}
				/>,
			),
		);

		const clusterEl = container.querySelector('[data-testid="cluster"]') as HTMLElement;
		expect(clusterEl).toBeTruthy();
		act(() => clusterEl.click());
		expect(picked).toEqual({ day: 1, startHour: 19 });
	});
});
