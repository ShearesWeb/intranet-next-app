import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PositionCard } from "@/components/allocation/position-card";
import RankApplicants from "@/app/dashboard/cca-allocation/rank-applicants/page";
import type { Position } from "@/types/applicants";

const state = vi.hoisted(() => ({ positions: [] as Position[] }));
vi.mock("@/lib/auth/auth-context", () => ({
	useAuth: () => ({ user: { email: "chair@example.test" } }),
}));
vi.mock("@/hooks/use-applicant-rankings", () => ({
	useApplicantRankings: () => ({
		positions: state.positions,
		ccaGroups: [{ cca_id: 1, cca_name: "Test CCA", positions: state.positions }],
		loading: false,
		mounted: true,
	}),
}));
vi.mock("@/components/allocation/add-applicant-dialog", () => ({
	AddApplicantDialog: () => null,
}));

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

function position(capacity: number, candidateCount: number, available: number): Position {
	return {
		id: 1,
		cca_id: 1,
		cca_name: "Test CCA",
		name: "Subcommittee",
		position_type: "subcomm",
		capacity,
		available_capacity: available,
		applicants: Array.from({ length: candidateCount }, (_, i) => ({
			id: i + 1,
			name: `Candidate ${i + 1}`,
			email: `candidate${i + 1}@example.test`,
			room: "01-01",
			ranking: i + 1,
		})),
	};
}

describe.each([
	{ capacity: 20, candidates: 20, remaining: 4, percent: 100, status: "Adequate" },
	{ capacity: 6, candidates: 5, remaining: 2, percent: 83, status: "Incomplete" },
	{ capacity: 4, candidates: 0, remaining: 1, percent: 0, status: "Empty" },
])("ranking coverage with $candidates candidates and $capacity seats", (example) => {
	it("preserves position coverage and its goal while availability changes", () => {
		let initialMeter: string | undefined;
		for (const available of [example.capacity, example.remaining, 0]) {
			act(() =>
				root.render(
					<PositionCard
						position={position(example.capacity, example.candidates, available)}
						hasChanges={false}
						onAddApplicant={() => {}}
						onRemoveApplicant={() => {}}
						onReorderApplicants={() => {}}
					/>,
				),
			);
			const meter = container.querySelector('[title*="recommended"]');
			expect(meter?.textContent).toContain(`${example.percent}%`);
			initialMeter ??= meter?.outerHTML;
			expect(meter?.outerHTML).toBe(initialMeter);
			expect(container.textContent).toContain(`${available}/${example.capacity} open`);
		}
	});

	it("preserves overview coverage and status across fresh page renders after allocation", () => {
		let initialMeter: string | undefined;
		for (const available of [example.capacity, example.remaining, 0]) {
			state.positions = [position(example.capacity, example.candidates, available)];
			act(() => root.render(<RankApplicants key={available} />));
			const meter = container.querySelector('[title*="recommended"]');
			expect(meter?.textContent).toContain(`${example.percent}%`);
			initialMeter ??= meter?.outerHTML;
			expect(meter?.outerHTML).toBe(initialMeter);
			expect(container.textContent).toContain(example.status);
		}
	});
});
