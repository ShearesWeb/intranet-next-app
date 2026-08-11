import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	canManageCcaServerSide,
	canManagePositionServerSide,
	checkCcaAuthorization,
	isLeadershipPositionType,
	isManagingAppointment,
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

describe("isManagingAppointment", () => {
	// Authority comes from the reporting chain, never from the title. See
	// intranet/docs/api/README.md#the-management-chain.
	it("is true when the position has reports beneath it", () => {
		expect(isManagingAppointment({ has_reports: true })).toBe(true);
	});

	it("is false for a lead with nobody reporting to it", () => {
		expect(isManagingAppointment({ has_reports: false })).toBe(false);
	});
});

describe("isLeadershipPositionType", () => {
	// Presentation only — it decides what a picker offers, never what a caller may do.
	const LEADERSHIP = ["lead", "vice"] as const;
	const NON_LEADERSHIP = [
		"blockcomm",
		"maincomm",
		"subcomm",
		"team-manager",
		"member",
		"resident",
	] as const;

	it.each(LEADERSHIP)("recognises %s", (positionType) => {
		expect(isLeadershipPositionType(positionType)).toBe(true);
	});

	it.each(NON_LEADERSHIP)("rejects %s", (positionType) => {
		expect(isLeadershipPositionType(positionType)).toBe(false);
	});

	it.each([undefined, null, ""])("rejects falsy / empty position type %p", (positionType) => {
		expect(isLeadershipPositionType(positionType as string | null | undefined)).toBe(false);
	});

	it("is case-insensitive and trims whitespace", () => {
		expect(isLeadershipPositionType("LEAD")).toBe(true);
		expect(isLeadershipPositionType("  Vice ")).toBe(true);
		expect(isLeadershipPositionType("MEMBER")).toBe(false);
	});
});

describe("canManageCcaServerSide", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("calls the can_manage_cca RPC with the cca id", async () => {
		const { supabase, rpc } = createSupabaseMock({ data: true, error: null });

		const result = await canManageCcaServerSide(supabase as never, 42);

		expect(rpc).toHaveBeenCalledTimes(1);
		expect(rpc).toHaveBeenCalledWith("can_manage_cca", { p_cca_id: 42 });
		expect(result).toBe(true);
	});

	it("returns false when the RPC returns false", async () => {
		const { supabase } = createSupabaseMock({ data: false, error: null });

		expect(await canManageCcaServerSide(supabase as never, 7)).toBe(false);
	});

	it("returns false on RPC error", async () => {
		const { supabase } = createSupabaseMock({ data: null, error: { message: "boom" } });

		expect(await canManageCcaServerSide(supabase as never, 9)).toBe(false);
	});

	it("returns false when the RPC throws", async () => {
		const supabase = { rpc: vi.fn().mockRejectedValue(new Error("network down")) };

		expect(await canManageCcaServerSide(supabase as never, 9)).toBe(false);
	});

	it("treats a null RPC response as false", async () => {
		const { supabase } = createSupabaseMock({ data: null, error: null });

		expect(await canManageCcaServerSide(supabase as never, 9)).toBe(false);
	});
});

describe("canManagePositionServerSide", () => {
	it("calls the can_manage_cca_position RPC with the position id", async () => {
		const { supabase, rpc } = createSupabaseMock({ data: true, error: null });

		const result = await canManagePositionServerSide(supabase as never, 5);

		expect(rpc).toHaveBeenCalledWith("can_manage_cca_position", { p_position_id: 5 });
		expect(result).toBe(true);
	});

	it("returns false on RPC error", async () => {
		const { supabase } = createSupabaseMock({ data: null, error: { message: "nope" } });

		expect(await canManagePositionServerSide(supabase as never, 5)).toBe(false);
	});
});

describe("checkCcaAuthorization", () => {
	const buildUser = (
		appointments: Array<{ cca_id: number; has_reports: boolean }> = [],
		isChair = appointments.some((a) => a.has_reports),
	) => ({
		id: 1,
		is_chair: isChair,
		appointments: appointments.map((a) => ({
			cca_id: a.cca_id,
			cca_name: "X",
			cca_kind: "sports" as const,
			position_id: 100,
			position_name: "X",
			position_type: "maincomm" as const,
			has_reports: a.has_reports,
			points: 0,
			commitment_period: "full-year" as const,
			team_status: "none" as const,
		})),
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 401 for unauthenticated callers", async () => {
		const result = await checkCcaAuthorization({ requestingUser: null });

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.status).toBe(401);
	});

	it("denies without a round-trip when is_chair is false", async () => {
		const { supabase, rpc } = createSupabaseMock({ data: true, error: null });
		const user = buildUser([{ cca_id: 99, has_reports: false }]);

		const result = await checkCcaAuthorization({
			requestingUser: user,
			cca: { id: 12 },
			supabase: supabase as never,
			require: "chair",
		});

		// is_chair === false is definitive: the caller manages nothing anywhere.
		expect(rpc).not.toHaveBeenCalled();
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.status).toBe(403);
	});

	it("consults can_manage_cca when the caller manages something somewhere", async () => {
		const { supabase, rpc } = createSupabaseMock({ data: true, error: null });
		const user = buildUser([{ cca_id: 99, has_reports: true }]);

		const result = await checkCcaAuthorization({
			requestingUser: user,
			cca: { id: 12 },
			supabase: supabase as never,
		});

		expect(rpc).toHaveBeenCalledWith("can_manage_cca", { p_cca_id: 12 });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.hasChairAccess).toBe(true);
			expect(result.data.viaReportingChain).toBe(true);
		}
	});

	it("grants access to a CCA the caller holds no appointment in, via the chain", async () => {
		// A JCRC director manages sports captains without being in those CCAs.
		const { supabase } = createSupabaseMock({ data: true, error: null });
		const user = buildUser([{ cca_id: 99, has_reports: true }]);

		const result = await checkCcaAuthorization({
			requestingUser: user,
			cca: { id: 12 },
			supabase: supabase as never,
			require: "chair",
		});

		expect(result.ok).toBe(true);
	});

	it("returns 403 when the DB check says no", async () => {
		const { supabase } = createSupabaseMock({ data: false, error: null });
		const user = buildUser([{ cca_id: 99, has_reports: true }]);

		const result = await checkCcaAuthorization({
			requestingUser: user,
			cca: { id: 12 },
			supabase: supabase as never,
			require: "chair",
		});

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.status).toBe(403);
	});

	it("marks results as degraded when no supabase client is supplied", async () => {
		const user = buildUser([{ cca_id: 99, has_reports: true }]);

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
		const user = buildUser([{ cca_id: 99, has_reports: true }]);

		const result = await checkCcaAuthorization({
			requestingUser: user,
			cca: { id: 12 },
			supabase: supabase as never,
		});

		expect(result.ok).toBe(true);
		if (result.ok) expect(result.degraded).toBeUndefined();
	});

	it("degraded-allows when the profile hint covers the CCA and no client is supplied", async () => {
		const user = buildUser([{ cca_id: 12, has_reports: true }]);

		const result = await checkCcaAuthorization({
			requestingUser: user,
			cca: { id: 12 },
			require: "chair",
		});

		expect(result.ok).toBe(true);
		if (result.ok) expect(result.data.hasChairAccess).toBe(true);
	});
});
