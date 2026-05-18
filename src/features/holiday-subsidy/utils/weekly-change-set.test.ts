import { describe, it, expect } from "vitest";
import { getCanSave, getHasPendingChanges, buildSavePayload } from "./weekly-change-set";
import type { WeeklyRow } from "./weekly-change-set";

function makeRow(overrides: Partial<WeeklyRow> = {}): WeeklyRow {
	return {
		id: 1,
		user_id: 100,
		position_id: 200,
		override_hours: null,
		comments: "",
		submitted: false,
		...overrides,
	};
}

describe("getCanSave", () => {
	it("returns true when selected row is new (not submitted)", () => {
		const row = makeRow({ id: 1, submitted: false });
		expect(getCanSave([row], new Set([1]), new Set())).toBe(true);
	});

	it("returns true when selected row is dirty and submitted", () => {
		const row = makeRow({ id: 1, submitted: true });
		expect(getCanSave([row], new Set([1]), new Set([1]))).toBe(true);
	});

	it("returns true when a submitted row is deselected", () => {
		const row = makeRow({ id: 1, submitted: true });
		expect(getCanSave([row], new Set(), new Set())).toBe(true);
	});

	it("returns false when selected submitted row has no dirty flag", () => {
		const row = makeRow({ id: 1, submitted: true });
		expect(getCanSave([row], new Set([1]), new Set())).toBe(false);
	});

	it("returns false when rows is empty", () => {
		expect(getCanSave([], new Set(), new Set())).toBe(false);
	});
});

describe("getHasPendingChanges", () => {
	it("returns true when a row is dirty even if not selected", () => {
		const row = makeRow({ id: 1, submitted: true });
		expect(getHasPendingChanges([row], new Set(), new Set([1]))).toBe(true);
	});

	it("returns true when a new row is selected", () => {
		const row = makeRow({ id: 1, submitted: false });
		expect(getHasPendingChanges([row], new Set([1]), new Set())).toBe(true);
	});

	it("returns true when submitted row is deselected", () => {
		const row = makeRow({ id: 1, submitted: true });
		expect(getHasPendingChanges([row], new Set(), new Set())).toBe(true);
	});

	it("returns false when selected submitted row has no dirty flag", () => {
		const row = makeRow({ id: 1, submitted: true });
		expect(getHasPendingChanges([row], new Set([1]), new Set())).toBe(false);
	});
});

describe("buildSavePayload", () => {
	it("builds declarations for selected new rows with null override (inherit envelope)", () => {
		const row = makeRow({
			id: 1,
			user_id: 10,
			position_id: 20,
			override_hours: null,
			comments: "",
			submitted: false,
		});
		const { declarations, deletions } = buildSavePayload([row], new Set([1]), new Set());
		expect(declarations).toEqual([{ user_id: 10, position_id: 20, hours: null, comments: null }]);
		expect(deletions).toEqual([]);
	});

	it("builds declarations for selected dirty submitted rows with override hours and comments", () => {
		const row = makeRow({
			id: 1,
			user_id: 10,
			position_id: 20,
			override_hours: 6,
			comments: "edited remark",
			submitted: true,
		});
		const { declarations } = buildSavePayload([row], new Set([1]), new Set([1]));
		expect(declarations).toEqual([
			{ user_id: 10, position_id: 20, hours: 6, comments: "edited remark" },
		]);
	});

	it("builds deletions for deselected submitted rows", () => {
		const row = makeRow({ id: 1, user_id: 10, position_id: 20, submitted: true });
		const { declarations, deletions } = buildSavePayload([row], new Set(), new Set());
		expect(declarations).toEqual([]);
		expect(deletions).toEqual([{ user_id: 10, position_id: 20 }]);
	});

	it("excludes selected submitted rows with no dirty flag from declarations", () => {
		const row = makeRow({ id: 1, submitted: true });
		const { declarations, deletions } = buildSavePayload([row], new Set([1]), new Set());
		expect(declarations).toEqual([]);
		expect(deletions).toEqual([]);
	});
});
