import { isChairPositionType } from "@/lib/cca/cca-chair-access";
import {
	computeRankingProgress,
	type ProgressEvaluationRow,
	type ProgressMemberRow,
	type RankingProgress,
} from "@/lib/ranking/ranking-progress";
import type { AuthenticatedUser, CcaType, PositionType } from "@/types/user";
import type { ManagedCcaPosition } from "@/types/cca-data";
import { createClient } from "@/lib/supabase/server";

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
	ranking_progress?: RankingProgress;
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

type AppointmentProgressRow = {
	user_id: number;
	position_id: number;
	cut_status: string | null;
	cca_positions:
		| { cca_id: number; position_type: string | null }
		| Array<{ cca_id: number; position_type: string | null }>
		| null;
};

/**
 * Ranked/total member counts per managed CCA in two batched queries
 * (all managed position ids at once), so the overview page stays at
 * O(1) queries regardless of how many CCAs the caller manages.
 */
async function loadRankingProgress(
	supabase: Awaited<ReturnType<typeof createClient>>,
	managedCcaRows: ManagedCcaViewRow[],
	ccasById: Map<number, CcaMetadataRow>,
): Promise<Map<number, RankingProgress>> {
	const managedPositionIds = Array.from(
		new Set(
			managedCcaRows.flatMap((row) =>
				(row.positions || []).map((position) => position.position_id),
			),
		),
	);

	if (managedPositionIds.length === 0) {
		return new Map();
	}

	const [membersResult, evaluationsResult] = await Promise.all([
		supabase
			.from("cca_appointments")
			.select("user_id, position_id, cut_status, cca_positions!inner(cca_id, position_type)")
			.in("position_id", managedPositionIds),
		supabase
			.from("cca_appointment_evaluations")
			.select("user_id, position_id, scores")
			.in("position_id", managedPositionIds),
	]);

	if (membersResult.error) throw membersResult.error;
	if (evaluationsResult.error) throw evaluationsResult.error;

	const members: ProgressMemberRow[] = ((membersResult.data || []) as AppointmentProgressRow[])
		.map((row) => {
			const position = Array.isArray(row.cca_positions) ? row.cca_positions[0] : row.cca_positions;
			if (!position) return null;
			return {
				cca_id: position.cca_id,
				user_id: row.user_id,
				position_id: row.position_id,
				position_type: position.position_type,
				cut_status: row.cut_status,
			};
		})
		.filter((row): row is ProgressMemberRow => row !== null);

	const ccaTypeById = new Map<number, string | null>(
		Array.from(ccasById.values()).map((cca) => [cca.id, cca.cca_type]),
	);

	return computeRankingProgress({
		members,
		evaluations: (evaluationsResult.data || []) as ProgressEvaluationRow[],
		ccaTypeById,
	});
}

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

	const progressByCca = await loadRankingProgress(supabase, managedCcaRows, ccasById);

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
			ranking_progress: hasManagedPositions
				? (progressByCca.get(ccaId) ?? { ranked: 0, total: 0 })
				: undefined,
		};
	});

	transformedData.sort((a, b) => a.name.localeCompare(b.name));

	return transformedData;
}
