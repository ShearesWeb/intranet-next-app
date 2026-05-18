// src/app/api/cca/[cca_name]/addMember/route.ts
// API route to add a member to a CCA (sports, culture, or others)
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
		const { user_id, position_id, commitment_period } = await request.json();

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
			// Find or create the "Member" position for this CCA if no position specified
			let { data: memberPosition } = await supabase
				.from("cca_positions")
				.select("id")
				.eq("cca_id", ccaData.id)
				.eq("position_type", "member")
				.single();

			if (!memberPosition) {
				// Create member position if it doesn't exist
				const { data: newPosition, error: createError } = await supabase
					.from("cca_positions")
					.insert({
						cca_id: ccaData.id,
						position_type: "member",
						name: "Member",
					})
					.select("id")
					.single();

				if (createError) {
					console.error("Error creating member position:", createError);
					return NextResponse.json({ error: "Failed to create member position" }, { status: 500 });
				}
				memberPosition = newPosition;
			}
			targetPositionId = memberPosition.id;
		}

		// Check if member already exists (composite PK on user_id/position_id; no id column).
		const { data: existingAppointment } = await supabase
			.from("cca_appointments")
			.select("user_id, position_id")
			.eq("user_id", user_id)
			.eq("position_id", targetPositionId)
			.single();

		if (existingAppointment) {
			return NextResponse.json(
				{
					error: "User is already appointed to this position",
				},
				{ status: 400 },
			);
		}

		// Validate the target position and check capacity
		const { data: positionInfo, error: positionInfoError } = await supabase
			.from("cca_positions")
			.select("id, cca_id, capacity")
			.eq("id", targetPositionId)
			.single();

		if (positionInfoError || !positionInfo) {
			return NextResponse.json({ error: "Position not found" }, { status: 404 });
		}

		if (positionInfo.cca_id !== ccaData.id) {
			return NextResponse.json({ error: "Position does not belong to this CCA" }, { status: 400 });
		}

		// App-side capacity pre-check is for friendly UX only.
		// The DB-side constraint trigger `internal.validate_cca_appointment` is the
		// authoritative guard and will reject inserts that would exceed capacity.
		if (positionInfo && positionInfo.capacity > 0) {
			const { count } = await supabase
				.from("cca_appointments")
				.select("*", { count: "exact", head: true })
				.eq("position_id", targetPositionId);

			if ((count || 0) >= positionInfo.capacity) {
				return NextResponse.json(
					{
						error: `Position capacity (${positionInfo.capacity}) would be exceeded. Current appointments: ${count || 0}.`,
					},
					{ status: 400 },
				);
			}
		}

		// Add the member. Omit `commitment_period` when undefined so the DB
		// column default ('full-year') fires; explicit caller values are honoured.
		const appointmentInsert: {
			user_id: number;
			position_id: number;
			points: number;
			commitment_period?: string;
		} = {
			user_id: user_id,
			position_id: targetPositionId,
			points: 0,
		};
		if (commitment_period !== undefined) {
			appointmentInsert.commitment_period = commitment_period;
		}
		const { error: appointmentError } = await supabase
			.from("cca_appointments")
			.insert(appointmentInsert);

		if (appointmentError) {
			console.error("Error adding member:", appointmentError);
			return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
		}

		return NextResponse.json({ success: true, position_id: targetPositionId });
	} catch (error) {
		console.error("Error adding member:", error);
		return NextResponse.json({ error: "Server error" }, { status: 500 });
	}
}
