import { describe, expect, it } from "vitest";
import { type CcaKind, type PositionType, type UserAppointment } from "@/types/user";
import {
	formatDayReach,
	getCommitteeBookingCcas,
	holdsJcrcBookingSeat,
	isCommitteeBookingAppointment,
	isJcrcBookingAppointment,
	isWithinCcaBookingLimit,
} from "./booking-eligibility";

function appointment(
	cca_id: number,
	cca_name: string,
	cca_kind: CcaKind,
	position_type: PositionType,
): UserAppointment {
	return {
		cca_id,
		cca_name,
		cca_kind,
		position_type,
		position_id: cca_id * 10,
		position_name: position_type,
		has_reports: false,
		points: 0,
		commitment_period: "full-year",
		team_status: "none",
	};
}

describe("booking seats", () => {
	it.each<[CcaKind, PositionType, boolean, boolean]>([
		["committee", "lead", true, false],
		["committee", "vice", true, false],
		["committee", "maincomm", false, false],
		["committee", "blockcomm", false, false],
		["committee", "subcomm", false, false],
		["committee", "resident", false, false],
		["jcrc", "lead", false, true],
		["jcrc", "vice", false, true],
		["jcrc", "maincomm", false, true],
		["jcrc", "blockcomm", false, false],
		["sports", "lead", false, false],
		["sports", "vice", false, false],
		["culture", "lead", false, false],
		["culture", "vice", false, false],
		["adhoc", "lead", false, false],
		["supplementary", "lead", false, false],
	])("%s %s -> committee %s, jcrc %s", (cca_kind, position_type, committee, jcrc) => {
		const seat = { cca_kind, position_type };
		expect(isCommitteeBookingAppointment(seat)).toBe(committee);
		expect(isJcrcBookingAppointment(seat)).toBe(jcrc);
	});

	it("does not depend on anyone reporting to the position", () => {
		const chair = { ...appointment(1, "SHWEB", "committee", "lead"), has_reports: false };
		expect(isCommitteeBookingAppointment(chair)).toBe(true);
		const captain = { ...appointment(2, "Volleyball", "sports", "lead"), has_reports: true };
		expect(isCommitteeBookingAppointment(captain)).toBe(false);
	});
});

describe("getCommitteeBookingCcas", () => {
	it("lists committees only, once each", () => {
		const user = {
			appointments: [
				appointment(1, "SHWEB", "committee", "lead"),
				appointment(1, "SHWEB", "committee", "vice"),
				appointment(2, "Director of Welfare", "jcrc", "lead"),
				appointment(3, "Volleyball", "sports", "lead"),
			],
		};
		expect(getCommitteeBookingCcas(user)).toEqual([{ id: 1, name: "SHWEB", kind: "committee" }]);
	});
});

describe("holdsJcrcBookingSeat", () => {
	it("covers JCRC roles and the Sheares Hall positions, but not blockcomm", () => {
		expect(
			holdsJcrcBookingSeat({ appointments: [appointment(2, "President", "jcrc", "lead")] }),
		).toBe(true);
		expect(
			holdsJcrcBookingSeat({ appointments: [appointment(6, "Sheares Hall", "jcrc", "lead")] }),
		).toBe(true);
		expect(
			holdsJcrcBookingSeat({ appointments: [appointment(2, "JCRC", "jcrc", "blockcomm")] }),
		).toBe(false);
	});
});

describe("isWithinCcaBookingLimit", () => {
	const TODAY = "2026-11-05"; // a Thursday
	const SHWEB = { id: 1, name: "SHWEB", kind: "committee" as const };
	const SHEARES_HALL = { id: 6, name: "Sheares Hall", kind: "jcrc" as const };

	it.each([
		["2026-11-05", true], // today
		["2026-11-12", true], // the same weekday next week
		["2026-11-13", false], // a day past that
		["2026-12-03", false],
	])("lets a committee book %s: %s", (date, allowed) => {
		expect(isWithinCcaBookingLimit(SHWEB, date, TODAY)).toBe(allowed);
	});

	it("counts the week across a month end", () => {
		expect(isWithinCcaBookingLimit(SHWEB, "2026-12-05", "2026-11-28")).toBe(true);
		expect(isWithinCcaBookingLimit(SHWEB, "2026-12-06", "2026-11-28")).toBe(false);
	});

	it("leaves Sheares Hall bookings to the booking weeks alone", () => {
		expect(isWithinCcaBookingLimit(SHEARES_HALL, "2026-12-03", TODAY)).toBe(true);
	});
});

describe("formatDayReach", () => {
	it.each([
		[1, "1 day"],
		[7, "1 week"],
		[10, "10 days"],
		[14, "2 weeks"],
	])("%i days reads as %s", (days, text) => {
		expect(formatDayReach(days)).toBe(text);
	});
});
