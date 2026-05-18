import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { getWeekDay } from "@/features/holiday-subsidy/utils/holiday-weeks";
import { SubsidyStatus } from "@/features/holiday-subsidy/types/declarations";
import {
	JoinedPositionSummary,
	WeeklyApprovalSubmission,
} from "@/features/holiday-subsidy/types/api";

type Params = {
	params: Promise<{
		ccaId: string;
		weekId: string;
	}>;
};

async function assertJcrcAccess() {
	const user = await fetchUserInfo();
	if (!user || (!user.is_jcrc && !user.is_admin)) {
		return {
			authorized: false as const,
			response: NextResponse.json({ error: "Not authorized. JCRC access only." }, { status: 403 }),
		};
	}
	return { authorized: true as const };
}

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
	if (Array.isArray(value)) return value[0] ?? null;
	return value ?? null;
}

/**
 * approve_user_subsidy errors share their semantics with approve_subsidy:
 * the same validate_*_transition trigger guards the state machine, and the
 * JCRC-only rule comes from the same internal.is_jcrc check. Map the same
 * surface to consistent HTTP codes.
 */
function mapApproveRpcError(message: string): { status: number; error: string } {
	if (message.startsWith("Invalid transition")) {
		return { status: 409, error: message };
	}
	if (message.startsWith("Only JCRC")) {
		return { status: 403, error: message };
	}
	if (message.includes("not found") || message.includes("not accessible")) {
		return { status: 404, error: message };
	}
	if (message.includes("only accepts")) {
		return { status: 400, error: message };
	}
	return { status: 400, error: message };
}

export async function GET(_request: Request, { params }: Params) {
	const disabledResponse = getCoreServiceDisabledApiResponse("holidaySubsidy");

	if (disabledResponse) {
		return disabledResponse;
	}

	try {
		const supabase = await createClient();
		const { ccaId, weekId } = await params;
		const ccaIdNum = Number(ccaId);
		const weekIdNum = Number(weekId);

		if (isNaN(ccaIdNum) || isNaN(weekIdNum)) {
			return NextResponse.json({ error: "Invalid CCA ID or Week ID" }, { status: 400 });
		}

		const authResult = await assertJcrcAccess();
		if (!authResult.authorized) {
			return authResult.response;
		}

		const day = getWeekDay(weekIdNum);
		if (!day) {
			return NextResponse.json({ error: "Unknown week" }, { status: 400 });
		}

		// cca_user_subsidies has no direct cca_id; walk up via
		// cca_subsidies (gives us envelope hours + position) and filter by
		// cca_positions.cca_id and cca_subsidies.day.
		const { data: submissions, error: submissionsError } = await supabase
			.from("cca_user_subsidies")
			.select(
				`
                id,
                subsidy_id,
                user_id,
                hours,
                comments,
                status,
                rejection_reason,
                cca_subsidies!inner (
                    id,
                    position_id,
                    day,
                    hours,
                    justification,
                    cca_positions!inner (
                        id,
                        name,
                        position_type,
                        cca_id
                    )
                )
            `,
			)
			.eq("cca_subsidies.cca_positions.cca_id", ccaIdNum)
			.eq("cca_subsidies.day", day);

		if (submissionsError) {
			console.error("Submissions error:", submissionsError);
			return NextResponse.json({ error: submissionsError.message }, { status: 500 });
		}

		const userIds = Array.from(
			new Set(
				((submissions as unknown as WeeklyApprovalSubmission[]) || []).map((sub) => sub.user_id),
			),
		);

		const directoryMap = new Map<number, { id: number; name: string; email: string }>();
		if (userIds.length > 0) {
			const { data: directoryRaw, error: directoryError } = await supabase
				.from("authenticated_user_directory")
				.select("id, name, email")
				.in("id", userIds);

			if (directoryError) {
				return NextResponse.json({ error: directoryError.message }, { status: 500 });
			}

			(directoryRaw || []).forEach((row: { id: number; name: string; email: string }) => {
				directoryMap.set(row.id, row);
			});
		}

		const submissionsData =
			((submissions as unknown as WeeklyApprovalSubmission[]) || []).map((sub) => {
				const envelope = unwrapRelation(sub.cca_subsidies);
				const position = envelope
					? unwrapRelation<JoinedPositionSummary>(envelope.cca_positions)
					: null;
				const directory = directoryMap.get(sub.user_id);
				// Effective hours: per-user override (if non-null) else envelope rate.
				const effectiveHours = sub.hours ?? envelope?.hours ?? 0;

				return {
					id: sub.id,
					user_subsidy_id: sub.id,
					subsidy_id: sub.subsidy_id,
					user_id: sub.user_id,
					position_id: envelope?.position_id ?? 0,
					name: directory?.name || `User #${sub.user_id}`,
					email: directory?.email || "",
					role: position?.name || "Member",
					type: position?.position_type || "",
					hours: effectiveHours,
					comments: sub.comments || "",
					justification: envelope?.justification || "",
					status: sub.status || SubsidyStatus.PENDING,
					rejection_reason: sub.rejection_reason ?? null,
				};
			}) || [];

		return NextResponse.json(
			{ submissions: submissionsData },
			{
				headers: {
					"Cache-Control": "no-store, private",
				},
			},
		);
	} catch (error) {
		console.error("Error fetching JCRC weekly approval data:", error);
		return NextResponse.json({ error: "Failed to load approval data" }, { status: 500 });
	}
}

export async function PATCH(request: Request, { params }: Params) {
	const disabledResponse = getCoreServiceDisabledApiResponse("holidaySubsidy");

	if (disabledResponse) {
		return disabledResponse;
	}

	try {
		const supabase = await createClient();
		const { ccaId, weekId } = await params;
		const ccaIdNum = Number(ccaId);
		const weekIdNum = Number(weekId);

		if (isNaN(ccaIdNum) || isNaN(weekIdNum)) {
			return NextResponse.json({ error: "Invalid CCA ID or Week ID" }, { status: 400 });
		}

		const authResult = await assertJcrcAccess();
		if (!authResult.authorized) {
			return authResult.response;
		}

		const body = await request.json();
		const updates = (body?.updates || []) as Array<{
			userSubsidyId: number;
			status: "approved" | "rejected";
			rejectionReason?: string | null;
		}>;

		if (!Array.isArray(updates) || updates.length === 0) {
			return NextResponse.json({ error: "No updates provided" }, { status: 400 });
		}

		for (const update of updates) {
			if (
				!update ||
				typeof update.userSubsidyId !== "number" ||
				(update.status !== "approved" && update.status !== "rejected")
			) {
				return NextResponse.json({ error: "Invalid update payload" }, { status: 400 });
			}
		}

		const results = await Promise.allSettled(
			updates.map((update) =>
				supabase
					.rpc("approve_user_subsidy", {
						p_user_subsidy_id: update.userSubsidyId,
						p_decision: update.status,
						p_reason: update.rejectionReason ?? null,
					})
					.single(),
			),
		);

		const failures: Array<{ userSubsidyId: number; status: number; error: string }> = [];
		let successCount = 0;

		results.forEach((result, idx) => {
			const update = updates[idx];
			if (result.status === "fulfilled") {
				const { error: rpcError } = result.value;
				if (rpcError) {
					const mapped = mapApproveRpcError(rpcError.message);
					failures.push({ userSubsidyId: update.userSubsidyId, ...mapped });
				} else {
					successCount += 1;
				}
			} else {
				const message =
					result.reason instanceof Error
						? result.reason.message
						: String(result.reason || "Unknown error");
				const mapped = mapApproveRpcError(message);
				failures.push({ userSubsidyId: update.userSubsidyId, ...mapped });
			}
		});

		if (failures.length > 0) {
			const statusOrder = [403, 409, 404, 400, 500];
			const status = statusOrder.find((code) => failures.some((f) => f.status === code)) ?? 400;
			return NextResponse.json(
				{
					error: failures.map((f) => `user_subsidy ${f.userSubsidyId}: ${f.error}`).join("; "),
					failures,
				},
				{ status },
			);
		}

		return NextResponse.json({
			message: `Successfully updated ${successCount} submission(s)`,
			updated: successCount,
		});
	} catch (error) {
		console.error("Error updating JCRC weekly approvals:", error);
		return NextResponse.json({ error: "Failed to update approvals" }, { status: 500 });
	}
}
