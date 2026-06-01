import { afterEach, describe, expect, it } from "vitest";
import { pgClientAsPersona, type PersonaPgClient } from "../../../src/test-utils/pg-client";

// managed_cca_positions (view/core/04) is a security_invoker view scoped to
// internal.auth_user_id(). It returns one row per CCA the caller is *relevant*
// to (member of, or has manageable positions in), with `positions` listing the
// positions the caller can manage in that CCA.
//
// Every persona is auto-appointed as a `resident` of their block's "Block
// Committee (X)" CCA by the baseline Sheares Hall seed, so that row always
// appears with an empty `positions` array. We therefore filter out the
// Block Committee rows when asserting the user-facing CCA mapping, and assert
// the manage-set (positions length > 0) separately.

type ManagedRow = { cca_name: string; npos: number };

async function managedRows(client: PersonaPgClient): Promise<ManagedRow[]> {
	const r = await client.query(
		"SELECT cca_name, json_array_length(positions) AS npos FROM managed_cca_positions ORDER BY cca_name",
	);
	return r.rows.map((row) => ({ cca_name: row.cca_name as string, npos: Number(row.npos) }));
}

function nonBlock(rows: ManagedRow[]): ManagedRow[] {
	return rows.filter((r) => !r.cca_name.startsWith("Block Committee"));
}

describe("managed_cca_positions — role-scoped CCA access", () => {
	let client: PersonaPgClient | null = null;

	afterEach(async () => {
		if (client) {
			await client.end();
			client = null;
		}
	});

	it("declan (Volleyball lead) is scoped to Volleyball and manages positions there", async () => {
		client = await pgClientAsPersona("declan");
		const rows = nonBlock(await managedRows(client));
		expect(rows.map((r) => r.cca_name)).toEqual(["Volleyball"]);
		expect(rows[0].npos).toBeGreaterThan(0);
	});

	it("layla (SHWEB lead) is scoped to SHWEB and manages positions there", async () => {
		client = await pgClientAsPersona("layla");
		const rows = nonBlock(await managedRows(client));
		expect(rows.map((r) => r.cca_name)).toEqual(["SHWEB"]);
		expect(rows[0].npos).toBeGreaterThan(0);
	});

	it("jasper (JCRC blockcomm leaf) is scoped to JCRC but manages no positions", async () => {
		client = await pgClientAsPersona("jasper");
		const rows = nonBlock(await managedRows(client));
		expect(rows.map((r) => r.cca_name)).toEqual(["JCRC"]);
		// Blockcomm is a leaf in the JCRC graph → membership row, zero manageable.
		expect(rows[0].npos).toBe(0);
	});

	it("brielle (JCRC maincomm) is scoped to JCRC and manages the blockcomm below", async () => {
		client = await pgClientAsPersona("brielle");
		const rows = nonBlock(await managedRows(client));
		expect(rows.map((r) => r.cca_name)).toEqual(["JCRC"]);
		expect(rows[0].npos).toBeGreaterThan(0);
	});

	it("aria (regular resident) has no CCA beyond her block committee and manages nothing", async () => {
		client = await pgClientAsPersona("aria");
		const rows = nonBlock(await managedRows(client));
		expect(rows).toHaveLength(0);
		const manages = (await managedRows(client)).filter((r) => r.npos > 0);
		expect(manages).toHaveLength(0);
	});

	it("nova (Basketball lead + SECC subcomm) is scoped to Basketball and SECC only", async () => {
		client = await pgClientAsPersona("nova");
		const rows = nonBlock(await managedRows(client));
		expect(rows.map((r) => r.cca_name).sort()).toEqual(["Basketball", "SECC"]);
		// Basketball lead manages positions; SECC subcomm is a leaf → membership only.
		const bball = rows.find((r) => r.cca_name === "Basketball")!;
		const secc = rows.find((r) => r.cca_name === "SECC")!;
		expect(bball.npos).toBeGreaterThan(0);
		expect(secc.npos).toBe(0);
	});

	it("declan's managed_cca_positions never leaks another lead's CCA (Basketball)", async () => {
		client = await pgClientAsPersona("declan");
		const names = (await managedRows(client)).map((r) => r.cca_name);
		expect(names).not.toContain("Basketball");
	});
});
