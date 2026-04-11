import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { getWeekLabel, isWeekEditable } from "@/lib/holiday-subsidy-weeks";
import {
	AppointmentWithSubsidy,
	JoinedPositionSummary,
	JoinedUserSummary,
	MemberWithDeclaration,
	PositionSubsidyRecord,
	UserSubsidyRecord,
} from "@/types/holiday-subsidy-api";

type Params = {
	params: Promise<{
		ccaId: string;
		weekId: string;
	}>;
};

export async function GET(_request: Request, { params }: Params) {
	const disabledResponse = getCoreServiceDisabledApiResponse("holidaySubsidy");

	if (disabledResponse) {
		return disabledResponse;
	}

	try {
		const supabase = await createClient();
		const { ccaId: ccaIdStr, weekId } = await params;
		const weekIdNum = parseInt(weekId);
		const ccaId = parseInt(ccaIdStr, 10);

		if (isNaN(weekIdNum)) {
			return NextResponse.json({ error: "Invalid week ID" }, { status: 400 });
		}

		if (isNaN(ccaId)) {
			return NextResponse.json({ error: "Invalid CCA ID" }, { status: 400 });
		}

		if (!isWeekEditable(weekIdNum)) {
			return NextResponse.json(
				{ error: `Weekly declarations are closed for ${getWeekLabel(weekIdNum) || "this week"}.` },
				{ status: 403 },
			);
		}

		// Get all appointments with position and user details in one query
		const { data: appointments, error: appointmentsError } = await supabase
			.from("cca_appointments")
			.select(
				`
                user_id,
                position_id,
                cca_positions (
                    id,
                    position_type,
                    name
                ),
                public_user_info (
                    id,
                    name,
                    email
                )
            `,
			)
			.eq("cca_id", ccaId);

		if (appointmentsError) {
			console.error("Appointments error:", appointmentsError);
			return NextResponse.json(
				{
					error: `Failed to fetch appointments: ${appointmentsError.message}`,
					details: appointmentsError,
				},
				{ status: 500 },
			);
		}

		const unwrapSingleRelation = <T>(value: T | T[] | null | undefined): T | null => {
			if (Array.isArray(value)) {
				return value[0] ?? null;
			}

			return value ?? null;
		};

		// Map the joined data to the expected structure
		const members: MemberWithDeclaration[] =
			appointments?.map((appointment: AppointmentWithSubsidy) => {
				const position = unwrapSingleRelation<JoinedPositionSummary>(appointment.cca_positions);
				const user = unwrapSingleRelation<JoinedUserSummary>(appointment.public_user_info);

				return {
					id: appointment.user_id,
					user_id: appointment.user_id,
					position_id: appointment.position_id,
					position_type: position?.position_type || "",
					position_name: position?.name || "Member",
					user_name: user?.name || `User #${appointment.user_id}`,
					user_email: user?.email || "",
				};
			}) || [];

		// Get approved subsidies and existing submissions in parallel for better performance
		const subsidyPositionIds = appointments?.map((a) => a.position_id) || [];
		const submissionUserIds = appointments?.map((a) => a.user_id) || [];

		const [subsidiesResult, submissionsResult] = await Promise.all([
			supabase
				.from("subsidies")
				.select("position_id, hours, justification")
				.in("position_id", subsidyPositionIds)
				.eq("week_id", weekIdNum)
				.eq("subsidy_status", "approved"),
			supabase
				.from("user_subsidies")
				.select("user_id, position_id, hours, justification, comments, subsidy_status")
				.in("user_id", submissionUserIds)
				.in("position_id", subsidyPositionIds)
				.eq("week_id", weekIdNum),
		]);

		if (subsidiesResult.error) {
			return NextResponse.json({ error: subsidiesResult.error.message }, { status: 500 });
		}

		if (submissionsResult.error) {
			return NextResponse.json({ error: submissionsResult.error.message }, { status: 500 });
		}

		const subsidies = subsidiesResult.data;
		const userSubmissions = submissionsResult.data;
		const approvedPositionIds = new Set(
			subsidies?.map((s: PositionSubsidyRecord) => s.position_id) || [],
		);

		// Build response with pre-fill logic
		const subsidyMap = new Map(
			subsidies?.map((s: PositionSubsidyRecord) => [s.position_id, s]) || [],
		);
		const submissionMap = new Map(
			userSubmissions?.map((s: UserSubsidyRecord) => [`${s.user_id}-${s.position_id}`, s]) || [],
		);

		const membersData =
			members
				?.map((member: MemberWithDeclaration) => {
					const approvedSubsidy = subsidyMap.get(member.position_id);
					const submission = submissionMap.get(`${member.user_id}-${member.position_id}`);

					return {
						id: member.user_id,
						user_id: member.user_id,
						position_id: member.position_id,
						name: member.user_name || "Unknown",
						email: member.user_email || "",
						role: member.position_name || "Member",
						type: member.position_type || "",

						// Flags
						has_approved_subsidy: !!approvedSubsidy,
						submitted: !!submission,

						// Data priority: submission > approved subsidy > empty
						hours: submission?.hours ?? approvedSubsidy?.hours ?? 0,
						justification: submission?.justification ?? approvedSubsidy?.justification ?? "",
						remarks: submission?.comments ?? "",
						status: submission?.subsidy_status ?? null,

						// Template data
						approved_hours: approvedSubsidy?.hours ?? null,
						approved_justification: approvedSubsidy?.justification ?? null,
					};
				})
				// Only include members with an approved subsidy for the week
				.filter((member) => approvedPositionIds.has(member.position_id)) || [];

		return NextResponse.json(
			{ members: membersData },
			{
				headers: {
					"Cache-Control": "no-store, private",
				},
			},
		);
	} catch (error) {
		console.error("=== ERROR in GET ===");
		console.error("Error:", error);
		console.error("Stack:", error instanceof Error ? error.stack : "No stack trace");
		return NextResponse.json(
			{
				error: "Failed to load weekly commitment data",
				message: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 },
		);
	}
}

export async function POST(request: Request, { params }: Params) {
	const disabledResponse = getCoreServiceDisabledApiResponse("holidaySubsidy");

	if (disabledResponse) {
		return disabledResponse;
	}

	try {
		const supabase = await createClient();
		const { ccaId: ccaIdStr, weekId } = await params;
		const weekIdNum = parseInt(weekId);
		const ccaId = parseInt(ccaIdStr, 10);

		if (isNaN(weekIdNum)) {
			return NextResponse.json({ error: "Invalid week ID" }, { status: 400 });
		}

		if (isNaN(ccaId)) {
			return NextResponse.json({ error: "Invalid CCA ID" }, { status: 400 });
		}

		const body = await request.json();
		const { declarations, deletions } = body;

		if (!Array.isArray(declarations) || !Array.isArray(deletions)) {
			return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
		}

		if (declarations.length === 0 && deletions.length === 0) {
			return NextResponse.json({ error: "No changes provided" }, { status: 400 });
		}

		// Validate all declarations before inserting
		for (const decl of declarations) {
			if (!decl.user_id || !decl.position_id || decl.hours === undefined) {
				return NextResponse.json(
					{ error: "Each declaration must have user_id, position_id, and hours" },
					{ status: 400 },
				);
			}
		}

		// Validate deletions
		for (const del of deletions) {
			if (!del.user_id || !del.position_id) {
				return NextResponse.json(
					{ error: "Each deletion must have user_id and position_id" },
					{ status: 400 },
				);
			}
		}

		// Upsert all declarations
		const upsertData = declarations.map((decl) => ({
			user_id: decl.user_id,
			position_id: decl.position_id,
			week_id: weekIdNum,
			hours: decl.hours,
			justification: decl.justification || "",
			comments: decl.remarks || "",
			subsidy_status: "pending",
		}));

		const { data: appointments, error: appointmentsError } = await supabase
			.from("cca_appointments")
			.select("user_id, position_id")
			.eq("cca_id", ccaId);

		if (appointmentsError) {
			console.error("Appointments error:", appointmentsError);
			return NextResponse.json(
				{ error: "Failed to validate members for this CCA" },
				{ status: 500 },
			);
		}

		const validPairs = new Set(
			(appointments || []).map((appt) => `${appt.user_id}-${appt.position_id}`),
		);

		const invalidDeclarations = upsertData.filter(
			(decl) => !validPairs.has(`${decl.user_id}-${decl.position_id}`),
		);
		const invalidDeletions = deletions.filter(
			(del: { user_id: number; position_id: number }) =>
				!validPairs.has(`${del.user_id}-${del.position_id}`),
		);

		if (invalidDeclarations.length > 0 || invalidDeletions.length > 0) {
			return NextResponse.json(
				{ error: "One or more selections are invalid for this CCA" },
				{ status: 400 },
			);
		}

		const operations: PromiseLike<unknown>[] = [];

		if (upsertData.length > 0) {
			operations.push(
				supabase
					.from("user_subsidies")
					.upsert(upsertData, {
						onConflict: "user_id,position_id,week_id",
					})
					.then(({ error }) => {
						if (error) throw error;
					}),
			);
		}

		if (deletions.length > 0) {
			const deletionConditions = deletions
				.map((del) => `and(user_id.eq.${del.user_id},position_id.eq.${del.position_id})`)
				.join(",");

			operations.push(
				supabase
					.from("user_subsidies")
					.delete()
					.eq("week_id", weekIdNum)
					.or(deletionConditions)
					.then(({ error }) => {
						if (error) throw error;
					}),
			);
		}

		try {
			await Promise.all(operations);
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "Failed to save changes";
			return NextResponse.json({ error: errorMessage }, { status: 500 });
		}

		const savedCount = upsertData.length;
		const deletedCount = deletions.length;

		return NextResponse.json(
			{
				success: true,
				message: `Saved ${savedCount} member commitment(s)${deletedCount ? `, deleted ${deletedCount}` : ""}`,
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error("Error saving weekly commitments:", error);
		return NextResponse.json({ error: "Failed to save weekly commitments" }, { status: 500 });
	}
}
