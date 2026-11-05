import { describe, expect, it } from "vitest";
import { type CcaKind, type PositionType, type UserAppointment } from "@/types/user";
import {
	getCommitteeBookingCcas,
	holdsJcrcBookingSeat,
	isCommitteeBookingAppointment,
	isJcrcBookingAppointment,
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
		expect(getCommitteeBookingCcas(user)).toEqual([{ id: 1, name: "SHWEB" }]);
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
