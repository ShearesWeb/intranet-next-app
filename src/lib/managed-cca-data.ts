import { isChairPositionType } from "@/features/cca/utils/cca-chair-access";
import type { AuthenticatedUser, CcaType, PositionType } from "@/types/User";
import { createClient } from "@/utils/supabase/server";

export type ManagedCcaPosition = {
	position_id: number;
	position_name: string;
	position_type: PositionType;
	description: string | null;
	access_depth: number;
};

export type ManagedCcaPositionsRow = {
	cca_id: number;
	cca_name: string;
	positions: ManagedCcaPosition[];
	id: number;
	name: string;
	role: string;
	position_type: PositionType | "";
	cca_type: CcaType | "committee";
	description: string;
	points: number;
	can_manage_members: boolean;
	can_rank_members: boolean;
};

type ChairAppointment = {
	cca_id: number;
	cca_name?: string | null;
	position_name: string;
	position_type: PositionType;
};

type ManagedCcaViewRow = {
	cca_id: number;
	cca_name: string | null;
	positions: ManagedCcaPosition[] | null;
};

type CcaMetadataRow = {
	id: number;
	name: string;
	cca_type: CcaType | null;
	description: string | null;
};

export async function getManagedCcaData(
	supabase: Awaited<ReturnType<typeof createClient>>,
	user: AuthenticatedUser,
): Promise<ManagedCcaPositionsRow[]> {
	const chairAppointments = (user.appointments || []).filter((appointment) =>
		isChairPositionType(appointment.position_type),
	) as ChairAppointment[];

	const chairAppointmentsByCcaId = new Map<number, ChairAppointment>();
	chairAppointments.forEach((appointment) => {
		if (!chairAppointmentsByCcaId.has(appointment.cca_id)) {
			chairAppointmentsByCcaId.set(appointment.cca_id, appointment);
		}
	});

	const { data: managedCcas, error: managedError } = await supabase
		.from("managed_cca_positions")
		.select("*");

	if (managedError) {
		throw managedError;
	}

	const managedCcaRows = (managedCcas || []) as ManagedCcaViewRow[];

	if (!managedCcaRows.length && chairAppointmentsByCcaId.size === 0) {
		return [];
	}

	const managedCcaById = new Map(managedCcaRows.map((row) => [row.cca_id, row]));
	const managedCcaIds = Array.from(
		new Set([...managedCcaRows.map((row) => row.cca_id), ...chairAppointmentsByCcaId.keys()]),
	);

	const { data: ccasData, error: ccasError } = await supabase
		.from("ccas")
		.select("id, name, cca_type, description")
		.in("id", managedCcaIds);

	if (ccasError) {
		throw ccasError;
	}

	const ccasById = new Map(((ccasData || []) as CcaMetadataRow[]).map((cca) => [cca.id, cca]));

	const transformedData = managedCcaIds.map((ccaId) => {
		const managedCca = managedCcaById.get(ccaId);
		const chairAppointment = chairAppointmentsByCcaId.get(ccaId);
		const ccaMeta = ccasById.get(ccaId);
		const managedPositions = managedCca?.positions || [];
		const primaryPosition = chairAppointment || managedPositions[0];
		const displayName =
			managedCca?.cca_name || chairAppointment?.cca_name || ccaMeta?.name || "Unknown CCA";
		const hasChairAccess = Boolean(chairAppointment);
		const hasManagedPositions = managedPositions.length > 0;

		return {
			cca_id: ccaId,
			cca_name: displayName,
			positions: managedPositions,
			id: ccaId,
			name: displayName,
			role: primaryPosition?.position_name || "Manager",
			position_type: primaryPosition?.position_type || "",
			cca_type: ccaMeta?.cca_type || "committee",
			description: ccaMeta?.description ?? "",
			points: 0,
			can_manage_members: hasChairAccess,
			can_rank_members: hasManagedPositions,
		};
	});

	transformedData.sort((a, b) => a.name.localeCompare(b.name));

	return transformedData;
}
