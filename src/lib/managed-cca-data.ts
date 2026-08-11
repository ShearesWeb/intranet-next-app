import type { CcaKind, PositionType } from "@/types/user";
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
	cca_kind: CcaKind | "committee";
	description: string;
	points: number;
	can_manage_members: boolean;
};

type ManagedCcaViewRow = {
	cca_id: number;
	cca_name: string | null;
	positions: ManagedCcaPosition[] | null;
};

type CcaMetadataRow = {
	id: number;
	name: string;
	kind: CcaKind | null;
	description: string | null;
};

/**
 * The CCAs the caller administers, with the positions they manage in each.
 *
 * `managed_cca_positions` is the whole answer: it is built from
 * `internal.managed_position_ids(internal.auth_user_id())`, so it already
 * reflects the full reporting chain, including positions that report across CCA
 * boundaries. The previous lead/vice appointment merge is gone — it existed to
 * paper over a title-based model the schema no longer uses.
 */
export async function getManagedCcaData(
	supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<ManagedCcaPositionsRow[]> {
	const { data: managedCcas, error: managedError } = await supabase
		.from("managed_cca_positions")
		.select("cca_id, cca_name, positions");

	if (managedError) {
		throw managedError;
	}

	const managedCcaRows = (managedCcas || []) as ManagedCcaViewRow[];

	if (!managedCcaRows.length) {
		return [];
	}

	const managedCcaIds = managedCcaRows.map((row) => row.cca_id);

	const { data: ccasData, error: ccasError } = await supabase
		.from("ccas")
		.select("id, name, kind, description")
		.in("id", managedCcaIds);

	if (ccasError) {
		throw ccasError;
	}

	const ccasById = new Map(((ccasData || []) as CcaMetadataRow[]).map((cca) => [cca.id, cca]));

	const transformedData: ManagedCcaPositionsRow[] = managedCcaRows.map((row) => {
		const ccaMeta = ccasById.get(row.cca_id);
		const managedPositions = row.positions || [];
		const primaryPosition = managedPositions[0];
		const displayName = row.cca_name || ccaMeta?.name || "Unknown CCA";

		return {
			cca_id: row.cca_id,
			cca_name: displayName,
			positions: managedPositions,
			id: row.cca_id,
			name: displayName,
			role: primaryPosition?.position_name || "Manager",
			position_type: primaryPosition?.position_type || "",
			cca_kind: ccaMeta?.kind || "committee",
			description: ccaMeta?.description ?? "",
			points: 0,
			can_manage_members: managedPositions.length > 0,
		};
	});

	transformedData.sort((a, b) => a.name.localeCompare(b.name));

	return transformedData;
}
