import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	canManageCcaServerSide,
	checkCcaAuthorization,
	isChairPositionType,
} from "./cca-chair-access";

type RpcResult = {
	data: unknown;
	error: unknown;
};

function createSupabaseMock(result: RpcResult) {
	const rpc = vi.fn().mockResolvedValue(result);
	return {
		supabase: { rpc },
		rpc,
	};
}

describe("isChairPositionType", () => {
	// Canonical position_type enum from ../intranet/db/changelogs/enum/03.position-type.sql
	const CHAIR_POSITIONS = ["lead", "vice"] as const;
	const NON_CHAIR_POSITIONS = [
		"blockcomm",
		"maincomm",
		"subcomm",
		"team manager",
		"member",
		"resident",
	] as const;

	it.each(CHAIR_POSITIONS)("recognises %s as a chair position", (positionType) => {
		expect(isChairPositionType(positionType)).toBe(true);
	});

	it.each(NON_CHAIR_POSITIONS)("rejects %s as a chair position", (positionType) => {
		expect(isChairPositionType(positionType)).toBe(false);
	});

	it.each([undefined, null, ""])("rejects falsy / empty position type %p", (positionType) => {
		expect(isChairPositionType(positionType as string | null | undefined)).toBe(false);
	});

	it("is case-insensitive", () => {
		expect(isChairPositionType("LEAD")).toBe(true);
		expect(isChairPositionType("Vice")).toBe(true);
		expect(isChairPositionType("MEMBER")).toBe(false);
	});

	it("trims surrounding whitespace", () => {
		expect(isChairPositionType("  lead  ")).toBe(true);
		expect(isChairPositionType(" vice")).toBe(true);
		expect(isChairPositionType("member ")).toBe(false);
	});
});

describe("canManageCcaServerSide", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("calls the can_manage_any_position_in_cca RPC with the cca id", async () => {
		const { supabase, rpc } = createSupabaseMock({ data: true, error: null });

		const result = await canManageCcaServerSide(supabase as never, 42);

		expect(rpc).toHaveBeenCalledTimes(1);
		expect(rpc).toHaveBeenCalledWith("can_manage_any_position_in_cca", {
			p_cca_id: 42,
		});
		expect(result).toBe(true);
	});

	it("returns false when the RPC returns false", async () => {
		const { supabase } = createSupabaseMock({ data: false, error: null });

		const result = await canManageCcaServerSide(supabase as never, 7);

		expect(result).toBe(false);
	});

	it("returns false on RPC error", async () => {
		const { supabase } = createSupabaseMock({ data: null, error: { message: "boom" } });

		const result = await canManageCcaServerSide(supabase as never, 9);

		expect(result).toBe(false);
	});

	it("returns false when the RPC throws", async () => {
		const supabase = {
			rpc: vi.fn().mockRejectedValue(new Error("network down")),
		};

		const result = await canManageCcaServerSide(supabase as never, 9);

		expect(result).toBe(false);
	});

	it("treats a null RPC response as false", async () => {
		const { supabase } = createSupabaseMock({ data: null, error: null });

		const result = await canManageCcaServerSide(supabase as never, 9);

		expect(result).toBe(false);
	});
});

describe("checkCcaAuthorization", () => {
	const buildUser = (appointments: Array<{ cca_id: number; position_type: string }> = []) => ({
		id: 1,
		appointments: appointments.map((a) => ({
			cca_id: a.cca_id,
			cca_name: "X",
			position_id: 100,
			position_name: "X",
			position_type: a.position_type,
			points: 0,
			commitment_period: "full-year" as const,
			cut_status: null,
		})),
	});

	it("returns 401 for unauthenticated callers", async () => {
		const result = await checkCcaAuthorization({ requestingUser: null });

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.status).toBe(401);
		}
	});

	it("returns chair access via the JWT fast path without calling the RPC", async () => {
		const { supabase, rpc } = createSupabaseMock({ data: true, error: null });
		const user = buildUser([{ cca_id: 12, position_type: "lead" }]);

		const result = await checkCcaAuthorization({
			requestingUser: user,
			cca: { id: 12 },
			supabase: supabase as never,
		});

		expect(rpc).not.toHaveBeenCalled();
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.hasChairAccess).toBe(true);
			expect(result.data.viaReportingChain).toBeUndefined();
			expect(result.data.authorizedCcaIds).toEqual([12]);
		}
	});

	it("falls back to the DB RPC when no chair appointment is present", async () => {
		const { supabase, rpc } = createSupabaseMock({ data: true, error: null });
		const user = buildUser([{ cca_id: 99, position_type: "maincomm" }]);

		const result = await checkCcaAuthorization({
			requestingUser: user,
			cca: { id: 12 },
			supabase: supabase as never,
		});

		expect(rpc).toHaveBeenCalledWith("can_manage_any_position_in_cca", {
			p_cca_id: 12,
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.hasChairAccess).toBe(true);
			expect(result.data.viaReportingChain).toBe(true);
		}
	});

	it("returns 403 when the JWT fast path fails and the DB widened check also returns false", async () => {
		const { supabase } = createSupabaseMock({ data: false, error: null });
		const user = buildUser([{ cca_id: 99, position_type: "member" }]);

		const result = await checkCcaAuthorization({
			requestingUser: user,
			cca: { id: 12 },
			supabase: supabase as never,
			require: "chair",
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.status).toBe(403);
		}
	});

	it("marks results as degraded when no supabase client is supplied", async () => {
		const user = buildUser([{ cca_id: 99, position_type: "member" }]);

		const result = await checkCcaAuthorization({
			requestingUser: user,
			cca: { id: 12 },
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.hasChairAccess).toBe(false);
			expect(result.degraded).toBe(true);
		}
	});

	it("does not mark results as degraded once the DB check has been consulted", async () => {
		const { supabase } = createSupabaseMock({ data: false, error: null });
		const user = buildUser([{ cca_id: 99, position_type: "member" }]);

		const result = await checkCcaAuthorization({
			requestingUser: user,
			cca: { id: 12 },
			supabase: supabase as never,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.degraded).toBeUndefined();
		}
	});

	it("require: 'chair' without supabase still degraded-allows when JWT says yes", async () => {
		const user = buildUser([{ cca_id: 12, position_type: "vice" }]);

		const result = await checkCcaAuthorization({
			requestingUser: user,
			cca: { id: 12 },
			require: "chair",
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.hasChairAccess).toBe(true);
		}
	});
});
