import { NextResponse } from "next/server";
import {
	canManageCcaMembers,
	getCcaMemberManagementDisabledMessage,
} from "@/features/cca/utils/cca-member-management";
import { createClient } from "@/utils/supabase/server";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { getManagedCcaAccess } from "@/features/cca/utils/cca-management-access";
import { normalizeCutStatusForCca } from "@/features/cca/utils/cca-cut-status";
import { MemberUpdate } from "@/features/cca/types/members";

const CUT_STATUSES_BY_CCA_TYPE = {
	sports: new Set(["ivp-ihg-team", "ihg-team", "final-cut"]),
	culture: new Set(["first-cut"]),
} as const;

export async function POST(request: Request, { params }: { params: Promise<{ ccaId: string }> }) {
	try {
		const { ccaId } = await params;
		const { user_id, position_id, cut_status, commitment_period } = await request.json();

		const supabase = await createClient();
		const requestingUser = await fetchUserInfo();

		if (!requestingUser) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const ccaIdNum = parseInt(ccaId, 10);
		if (isNaN(ccaIdNum)) {
			return NextResponse.json({ error: "Invalid CCA ID" }, { status: 400 });
		}

		const { data: ccaData, error: ccaError } = await supabase
			.from("ccas")
			.select("id, name, cca_type")
			.eq("id", ccaIdNum)
			.single();

		if (ccaError || !ccaData) {
			return NextResponse.json({ error: "CCA not found" }, { status: 404 });
		}

		if (
			!canManageCcaMembers(ccaData.cca_type) &&
			(cut_status !== undefined || commitment_period !== undefined)
		) {
			return NextResponse.json(
				{ error: getCcaMemberManagementDisabledMessage(ccaData.cca_type) },
				{ status: 403 },
			);
		}

		const authResult = await getManagedCcaAccess({
			supabase,
			requestingUser,
			cca: ccaData,
			accessLevel: "manage_members",
		});

		if (!authResult.ok) {
			return NextResponse.json(
				{
					error: authResult.error,
				},
				{ status: authResult.status },
			);
		}

		const normalizedCutStatus =
			typeof cut_status === "string"
				? normalizeCutStatusForCca(cut_status, ccaData.cca_type)
				: cut_status;

		console.log("Updating member:", {
			user_id,
			position_id,
			cut_status: normalizedCutStatus,
			commitment_period,
		});

		if (cut_status !== undefined && cut_status !== null) {
			if (typeof cut_status !== "string") {
				return NextResponse.json({ error: "Invalid cut status" }, { status: 400 });
			}

			const allowedStatuses =
				CUT_STATUSES_BY_CCA_TYPE[ccaData.cca_type as keyof typeof CUT_STATUSES_BY_CCA_TYPE];
			if (!allowedStatuses?.has(normalizedCutStatus)) {
				return NextResponse.json(
					{ error: "Cut status is not allowed for this CCA type" },
					{ status: 400 },
				);
			}
		}

		const updates: MemberUpdate = {};
		if (cut_status !== undefined) updates.cut_status = normalizedCutStatus;
		if (commitment_period !== undefined) updates.commitment_period = commitment_period;

		if (Object.keys(updates).length === 0) {
			return NextResponse.json({ success: true });
		}

		if ((cut_status !== undefined || commitment_period !== undefined) && !position_id) {
			return NextResponse.json(
				{ error: "position_id is required for member updates" },
				{ status: 400 },
			);
		}

		const { data: updatedRows, error } = await supabase
			.from("cca_appointments")
			.update(updates)
			.select("user_id, position_id")
			.eq("user_id", user_id)
			.eq("position_id", position_id);

		if (error) {
			console.error("Error updating member:", error);
			return NextResponse.json({ error: "Failed to update member" }, { status: 500 });
		}

		if (!updatedRows || updatedRows.length === 0) {
			return NextResponse.json(
				{ error: "No matching member appointment found for update" },
				{ status: 404 },
			);
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error updating member:", error);
		return NextResponse.json({ error: "Server error" }, { status: 500 });
	}
}
