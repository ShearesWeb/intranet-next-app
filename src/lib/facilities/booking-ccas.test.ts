import { beforeEach, describe, expect, it, vi } from "vitest";
import { type CcaKind, type PositionType, type UserAppointment } from "@/types/user";

const mocks = vi.hoisted(() => ({
	maybeSingle: vi.fn(),
	eq: vi.fn(),
	from: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
	createClient: async () => ({ from: mocks.from }),
}));

function appointment(
	cca_id: number,
	cca_name: string,
	cca_kind: CcaKind,
	position_type: PositionType,
) {
	return { cca_id, cca_name, cca_kind, position_type } as UserAppointment;
}

// What the `ccas` lookup returns; getBookingCcas adds the kind it filtered on.
const SHEARES_HALL_ROW = { id: 6, name: "Sheares Hall" };
const SHEARES_HALL = { id: 6, name: "Sheares Hall", kind: "jcrc" };
const SHWEB_LEAD = appointment(1, "SHWEB", "committee", "lead");
const WELFARE_LEAD = appointment(58, "Director of Welfare", "jcrc", "lead");
const CAPTAIN = appointment(3, "Volleyball", "sports", "lead");

describe("booking CCAs", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		const query = { select: () => query, eq: mocks.eq, maybeSingle: mocks.maybeSingle };
		mocks.eq.mockReturnValue(query);
		mocks.from.mockReturnValue(query);
		mocks.maybeSingle.mockResolvedValue({ data: SHEARES_HALL_ROW, error: null });
	});

	it("books a committee chair under the committee without a lookup", async () => {
		const { getBookingCcas } = await import("./booking-ccas");
		await expect(getBookingCcas({ appointments: [SHWEB_LEAD, CAPTAIN] })).resolves.toEqual([
			{ id: 1, name: "SHWEB", kind: "committee" },
		]);
		expect(mocks.from).not.toHaveBeenCalled();
	});

	it("books a JCRC role under Sheares Hall, not the role's own CCA", async () => {
		const { getBookingCcas } = await import("./booking-ccas");
		await expect(getBookingCcas({ appointments: [WELFARE_LEAD] })).resolves.toEqual([SHEARES_HALL]);
		expect(mocks.from).toHaveBeenCalledWith("ccas");
		expect(mocks.eq).toHaveBeenCalledWith("name", "Sheares Hall");
		expect(mocks.eq).toHaveBeenCalledWith("kind", "jcrc");
	});

	it("offers both when the user chairs a committee and holds a JCRC role", async () => {
		const { getBookingCcas } = await import("./booking-ccas");
		await expect(getBookingCcas({ appointments: [SHWEB_LEAD, WELFARE_LEAD] })).resolves.toEqual([
			{ id: 1, name: "SHWEB", kind: "committee" },
			SHEARES_HALL,
		]);
	});

	it("offers nothing to a captain", async () => {
		const { getBookingCcas } = await import("./booking-ccas");
		await expect(getBookingCcas({ appointments: [CAPTAIN] })).resolves.toEqual([]);
	});

	it("fails rather than guessing when Sheares Hall cannot be found", async () => {
		mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
		vi.spyOn(console, "error").mockImplementation(() => {});
		const { getBookingCcas } = await import("./booking-ccas");
		await expect(getBookingCcas({ appointments: [WELFARE_LEAD] })).rejects.toMatchObject({
			statusCode: 500,
		});
	});

	it("does not let a JCRC role book under its own CCA", async () => {
		const { canBookForCca } = await import("./booking-ccas");
		const user = { appointments: [WELFARE_LEAD] };
		await expect(canBookForCca(user, SHEARES_HALL.id)).resolves.toBe(true);
		await expect(canBookForCca(user, WELFARE_LEAD.cca_id)).resolves.toBe(false);
	});
});
