// src/app/api/cca/[cca_name]/removeMember/route.ts
// API route to remove a member from a sports or culture CCA
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
	canManageCcaMembers,
	getCcaMemberManagementDisabledMessage,
} from "@/features/cca/utils/cca-member-management";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { getManagedCcaAccess } from "@/features/cca/utils/cca-management-access";

export async function POST(request: Request, { params }: { params: Promise<{ ccaId: string }> }) {
	try {
		const { ccaId } = await params;
		const { user_id, position_id } = await request.json();

		const supabase = await createClient();

		// Verify authentication and get user ID
		const requestingUser = await fetchUserInfo();

		if (!requestingUser) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Get CCA data
		const { data: ccaData, error: ccaError } = await supabase
			.from("ccas")
			.select("id, name, cca_type")
			.eq("id", ccaId)
			.single();

		if (ccaError || !ccaData) {
			return NextResponse.json({ error: "CCA not found" }, { status: 404 });
		}

		if (!canManageCcaMembers(ccaData.cca_type)) {
			return NextResponse.json(
				{ error: getCcaMemberManagementDisabledMessage(ccaData.cca_type) },
				{ status: 403 },
			);
		}

		// Verify requesting user has lead/vice role for this CCA
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

		let targetPositionId = position_id;

		if (!targetPositionId) {
			const { data: memberPosition } = await supabase
				.from("cca_positions")
				.select("id")
				.eq("cca_id", ccaData.id)
				.eq("position_type", "member")
				.single();

			if (!memberPosition) {
				return NextResponse.json({ error: "Member position not found" }, { status: 404 });
			}
			targetPositionId = memberPosition.id;
		}

		// Remove the member
		const { error: removeError } = await supabase
			.from("cca_appointments")
			.delete()
			.eq("user_id", user_id)
			.eq("position_id", targetPositionId);

		if (removeError) {
			console.error("Error removing member:", removeError);
			return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
		}

		// Note: previously logged to `cca_allocation_events` for audit purposes; that table was
		// dropped in the schema refactor and has no documented replacement. `cca_appointments.cut_status`
		// is now the sole record of cut/uncut transitions.

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error removing member:", error);
		return NextResponse.json({ error: "Server error" }, { status: 500 });
	}
}
