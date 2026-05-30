import { createClient } from "@/lib/supabase/server";
import { unwrapRelation } from "@/lib/supabase/helpers";
import { ApiError } from "@/lib/api/errors";
import type { CalendarDeclaration, SubsidyStatus } from "@/types/declarations";

type EnvelopeRow = {
	id: number;
	position_id: number;
	day: string;
	hours: number;
	justification: string | null;
	status: SubsidyStatus;
	rejection_reason: string | null;
	cca_positions?:
		| {
				id: number;
				name: string;
				position_type: string;
				cca_id: number;
				ccas?: { id: number; name: string } | Array<{ id: number; name: string }> | null;
		  }
		| Array<{
				id: number;
				name: string;
				position_type: string;
				cca_id: number;
				ccas?: { id: number; name: string } | Array<{ id: number; name: string }> | null;
		  }>
		| null;
};

type MemberCounts = { total: number; approved: number; pending: number };

function projectRow(row: EnvelopeRow, counts: MemberCounts): CalendarDeclaration {
	const position = unwrapRelation(row.cca_positions);
	const cca = position ? unwrapRelation(position.ccas) : null;
	return {
		id: row.id,
		position_id: row.position_id,
		day: row.day,
		hours: row.hours,
		justification: row.justification,
		status: row.status,
		rejection_reason: row.rejection_reason,
		position_name: position?.name ?? "",
		position_type: position?.position_type ?? "",
		cca_id: cca?.id ?? position?.cca_id ?? 0,
		cca_name: cca?.name ?? "",
		member_count: counts.total,
		approved_member_count: counts.approved,
		pending_member_count: counts.pending,
	};
}

export async function getCalendarDeclarations(params: {
	startDate: string;
	endDate: string;
	ccaIds?: number[];
}): Promise<CalendarDeclaration[]> {
	const supabase = await createClient();

	const query = supabase
		.from("cca_subsidies")
		.select(
			`id, position_id, day, hours, justification, status, rejection_reason,
			cca_positions!inner (
				id, name, position_type, cca_id,
				ccas!inner (id, name)
			)`,
		)
		.gte("day", params.startDate)
		.lte("day", params.endDate);

	if (params.ccaIds?.length) {
		query.in("cca_positions.cca_id", params.ccaIds);
	}

	const { data, error } = await query;

	if (error) throw new ApiError(500, error.message);

	const rows = (data as unknown as EnvelopeRow[]) || [];
	if (rows.length === 0) return [];

	const subsidyIds = rows.map((r) => r.id);
	const { data: userSubRows, error: countError } = await supabase
		.from("cca_user_subsidies")
		.select("subsidy_id, status")
		.in("subsidy_id", subsidyIds);

	if (countError) throw new ApiError(500, countError.message);

	const defaultCounts = (): MemberCounts => ({ total: 0, approved: 0, pending: 0 });
	const countMap = new Map<number, MemberCounts>();
	(userSubRows || []).forEach((row: { subsidy_id: number; status: string | null }) => {
		const c = countMap.get(row.subsidy_id) ?? defaultCounts();
		c.total += 1;
		if (row.status === "approved") c.approved += 1;
		else if (row.status === "pending") c.pending += 1;
		countMap.set(row.subsidy_id, c);
	});

	return rows.map((row) => projectRow(row, countMap.get(row.id) ?? defaultCounts()));
}
