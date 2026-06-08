import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderingTable, type OrderingTableColumn } from "@/components/table/ordering-table";

interface Row {
	id: number;
	name: string;
	room: string;
}

const DATA: Row[] = [
	{ id: 1, name: "Aria Tan", room: "12-3" },
	{ id: 2, name: "Bob Lim", room: "04-1" },
	{ id: 3, name: "Cara Ng", room: "08-2" },
];

const COLUMNS: OrderingTableColumn<Row>[] = [
	{ accessorKey: "name", header: "Name" },
	{ accessorKey: "room", header: "Room" },
];

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

function render(props: Partial<React.ComponentProps<typeof OrderingTable<Row>>> = {}) {
	act(() => {
		root.render(
			<OrderingTable<Row>
				data={DATA}
				columns={COLUMNS}
				showMoveControls
				searchable
				{...props}
			/>,
		);
	});
}

function setInputValue(input: HTMLInputElement, value: string) {
	const setter = Object.getOwnPropertyDescriptor(
		window.HTMLInputElement.prototype,
		"value",
	)!.set!;
	act(() => {
		setter.call(input, value);
		input.dispatchEvent(new Event("input", { bubbles: true }));
	});
}

describe("OrderingTable move controls", () => {
	it("move-to-bottom on the first row reorders via onReorder", () => {
		const onReorder = vi.fn();
		render({ onReorder });

		const toBottom = container.querySelector<HTMLButtonElement>('button[title="Move to bottom"]')!;
		act(() => toBottom.click());

		expect(onReorder).toHaveBeenCalledTimes(1);
		expect(onReorder.mock.calls[0][0].map((r: Row) => r.id)).toEqual([2, 3, 1]);
	});

	it("disables move-to-top on the first row", () => {
		render({ onReorder: vi.fn() });
		const toTop = container.querySelector<HTMLButtonElement>('button[title="Move to top"]')!;
		expect(toTop.disabled).toBe(true);
	});
});

describe("OrderingTable search", () => {
	it("filters rows by any string field and disables reordering while filtering", () => {
		render({ onReorder: vi.fn() });

		const input = container.querySelector<HTMLInputElement>("input")!;
		setInputValue(input, "bob");

		const bodyText = container.querySelector("tbody")!.textContent ?? "";
		expect(bodyText).toContain("Bob Lim");
		expect(bodyText).not.toContain("Aria Tan");
		expect(bodyText).not.toContain("Cara Ng");

		// While filtering, move controls are disabled (reordering is ambiguous).
		const moveButtons = container.querySelectorAll<HTMLButtonElement>(
			'button[title="Move to top"], button[title="Move to bottom"]',
		);
		expect(moveButtons.length).toBeGreaterThan(0);
		moveButtons.forEach((b) => expect(b.disabled).toBe(true));
	});

	it("shows a no-matches message when nothing matches", () => {
		render({ onReorder: vi.fn() });
		const input = container.querySelector<HTMLInputElement>("input")!;
		setInputValue(input, "zzz-nobody");
		expect(container.querySelector("tbody")!.textContent).toContain("No matches.");
	});
});
