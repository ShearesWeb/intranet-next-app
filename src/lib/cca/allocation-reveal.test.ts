import { describe, expect, it } from "vitest";

import { buildAllocationReveal, revealSeenStorageKey } from "./allocation-reveal";
import type { CCAData } from "@/types/cca-data";
import type { PositionType } from "@/types/user";

function cca(overrides: Partial<CCAData> & { id: number; position_type: PositionType }): CCAData {
	return {
		name: `CCA ${overrides.id}`,
		role: "Member",
		cca_kind: "sports",
		description: "A CCA.",
		points: 5,
		...overrides,
	};
}

const VOLLEYBALL = cca({
	id: 1,
	name: "Sheares Volleyball",
	role: "Training IC",
	position_type: "maincomm",
});
const BLOCK_D = cca({
	id: 2,
	name: "Block D Committee",
	role: "Block Rep",
	position_type: "blockcomm",
	cca_kind: "committee",
});
const DANCE = cca({
	id: 3,
	name: "Sheares Dance",
	role: "Publicity",
	position_type: "subcomm",
	cca_kind: "culture",
});
const PLAIN_MEMBER = cca({ id: 4, position_type: "member" });

describe("buildAllocationReveal — maincomm round", () => {
	it("reveals maincomm and blockcomm appointments", () => {
		const reveal = buildAllocationReveal([VOLLEYBALL, BLOCK_D, PLAIN_MEMBER], "maincomm");

		expect(reveal.outcome).toBe("allocated");
		expect(reveal.slots.map((slot) => slot.name)).toEqual([
			"Sheares Volleyball",
			"Block D Committee",
		]);
		expect(reveal.consolation).toBeNull();
		expect(reveal.hasLaterRound).toBe(true);
	});

	it("counts leads and vices as maincomm-round roles, ordered above maincomm", () => {
		const chair = cca({ id: 5, name: "Sheares Band", role: "Chairperson", position_type: "lead" });

		const reveal = buildAllocationReveal([VOLLEYBALL, chair], "maincomm");

		expect(reveal.slots.map((slot) => slot.position)).toEqual(["Chairperson", "Training IC"]);
	});

	it("ignores subcomm appointments — they belong to the later round", () => {
		const reveal = buildAllocationReveal([DANCE], "maincomm");

		expect(reveal.outcome).toBe("none");
		expect(reveal.slots).toEqual([]);
	});

	it("consoles with the subcomm round still ahead", () => {
		const reveal = buildAllocationReveal([PLAIN_MEMBER], "maincomm");

		expect(reveal.consolation?.followUp).toContain("subcomm round ahead");
		expect(reveal.consolation?.closer).toContain("shearite");
	});
});

describe("buildAllocationReveal — subcomm round", () => {
	it("carries earlier-round appointments in, flagged as already revealed", () => {
		const reveal = buildAllocationReveal([DANCE, VOLLEYBALL, BLOCK_D], "subcomm");

		expect(reveal.slots.map((slot) => [slot.name, slot.revealedEarlier])).toEqual([
			["Sheares Volleyball", true],
			["Block D Committee", true],
			["Sheares Dance", false],
		]);
		expect(reveal.hasLaterRound).toBe(false);
	});

	it("points an empty round at the maincomm roles the resident already holds", () => {
		const reveal = buildAllocationReveal([VOLLEYBALL], "subcomm");

		expect(reveal.outcome).toBe("none");
		expect(reveal.slots).toEqual([]);
		expect(reveal.consolation?.followUp).toContain("already been allocated");
		// Telling someone who holds a maincomm role they are "still a shearite"
		// reads as a brush-off, so the closer is dropped on this branch.
		expect(reveal.consolation?.closer).toBeNull();
	});

	it("offers other ways to be involved when there was nothing earlier either", () => {
		const reveal = buildAllocationReveal([PLAIN_MEMBER], "subcomm");

		expect(reveal.consolation?.followUp).toContain("plenty of other ways");
		expect(reveal.consolation?.closer).toContain("shearite");
	});
});

describe("revealSeenStorageKey", () => {
	it("scopes the key by user and round so a shared browser never replays someone else's", () => {
		expect(revealSeenStorageKey(42, "maincomm")).toBe("sheares:allocation-reveal-seen:42:maincomm");
		expect(revealSeenStorageKey(42, "subcomm")).not.toBe(revealSeenStorageKey(43, "subcomm"));
	});
});
