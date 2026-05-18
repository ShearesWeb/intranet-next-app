import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getCoreServiceDisabledApiResponse } from "@/lib/feature-flags";
import {
	getWeekDay,
	getWeekLabel,
	isWeekEditable,
} from "@/features/holiday-subsidy/utils/holiday-weeks";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { checkCcaAuthorization } from "@/features/cca/utils/cca-chair-access";
import { SubsidyStatus } from "@/features/holiday-subsidy/types/declarations";

type Params = {
	params: Promise<{
		ccaId: string;
		weekId: string;
	}>;
};

type JoinedPosition = {
	id: number;
	name: string;
	position_type: string;
	cca_id?: number;
};

async function authorizeChair(ccaId: number) {
	const user = await fetchUserInfo();
	if (!user) {
		return { authorized: false, status: 401, message: "Unauthorized" };
	}

	const result = await checkCcaAuthorization({
		requestingUser: user,
		cca: { id: ccaId, name: null, cca_type: null },
		require: "chair",
	});

	if (!result.ok) {
		return { authorized: false, status: result.status, message: result.error };
	}

	return { authorized: true, status: 200 };
}

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
	if (Array.isArray(value)) return value[0] ?? null;
	return value ?? null;
}

/**
 * Map common trigger errors raised by cca_user_subsidies writes.
 *
 * `enforce_parent_approved_before_iud` raises `Parent subsidy must be approved
 * (current status: %)` whenever inserting / changing a child to non-rejected
 * when the parent envelope is not yet `approved`. We surface this as 409 to
 * disambiguate from a missing-envelope (400) and from a status-machine
 * transition violation (also 409, but on update).
 */
function mapUserSubsidyError(message: string): { status: number; error: string } {
	if (message.includes("Parent subsidy must be approved")) {
		return {
			status: 409,
			error: "Cannot add members until the envelope is approved",
		};
	}
	if (message.startsWith("Invalid transition")) {
		return { status: 409, error: message };
	}
	if (message.includes("already approved") || message.includes("cannot upsert")) {
		return { status: 409, error: message };
	}
	if (message.includes("Cannot modify hours after approval")) {
		return { status: 409, error: message };
	}
	if (message.includes("No authenticated user")) {
		return { status: 401, error: "Unauthorized" };
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

		const day = getWeekDay(weekIdNum);
		if (!day) {
			return NextResponse.json({ error: "Unknown week" }, { status: 400 });
		}

		const authResult = await authorizeChair(ccaId);
		if (!authResult.authorized) {
			return NextResponse.json({ error: authResult.message }, { status: authResult.status });
		}

		// 1. Approved envelopes for this CCA on the given day.
		// cca_appointments has no cca_id column — filter via cca_positions.cca_id.
		const { data: envelopesRaw, error: envelopesError } = await supabase
			.from("cca_subsidies")
			.select(
				`id, position_id, hours, justification, status,
                 cca_positions!inner (id, name, position_type, cca_id)`,
			)
			.eq("cca_positions.cca_id", ccaId)
			.eq("day", day)
			.eq("status", SubsidyStatus.APPROVED);

		if (envelopesError) {
			return NextResponse.json({ error: envelopesError.message }, { status: 500 });
		}

		type EnvelopeRow = {
			id: number;
			position_id: number;
			hours: number;
			justification: string | null;
			status: SubsidyStatus;
			cca_positions: JoinedPosition | JoinedPosition[] | null;
		};

		const envelopes = (envelopesRaw || []) as EnvelopeRow[];
		const envelopesByPosition = new Map<
			number,
			{ id: number; hours: number; justification: string | null; position: JoinedPosition | null }
		>();
		envelopes.forEach((envelope) => {
			envelopesByPosition.set(envelope.position_id, {
				id: envelope.id,
				hours: envelope.hours,
				justification: envelope.justification,
				position: unwrapRelation(envelope.cca_positions),
			});
		});

		// 2. Appointments under this CCA (join through positions).
		const { data: appointmentsRaw, error: appointmentsError } = await supabase
			.from("cca_appointments")
			.select(
				`user_id, position_id,
                 cca_positions!inner (id, name, position_type, cca_id)`,
			)
			.eq("cca_positions.cca_id", ccaId);

		if (appointmentsError) {
			console.error("Appointments error:", appointmentsError);
			return NextResponse.json(
				{ error: `Failed to fetch appointments: ${appointmentsError.message}` },
				{ status: 500 },
			);
		}

		type AppointmentRow = {
			user_id: number;
			position_id: number;
			cca_positions: JoinedPosition | JoinedPosition[] | null;
		};
		const appointments = (appointmentsRaw || []) as AppointmentRow[];

		// 3. Existing per-user subsidy rows under those envelopes.
		const subsidyIds = Array.from(envelopesByPosition.values()).map((e) => e.id);
		let userSubs: Array<{
			id: number;
			subsidy_id: number;
			user_id: number;
			hours: number | null;
			comments: string | null;
			status: SubsidyStatus | null;
			rejection_reason: string | null;
		}> = [];

		if (subsidyIds.length > 0) {
			const { data: subsRaw, error: subsError } = await supabase
				.from("cca_user_subsidies")
				.select("id, subsidy_id, user_id, hours, comments, status, rejection_reason")
				.in("subsidy_id", subsidyIds);

			if (subsError) {
				return NextResponse.json({ error: subsError.message }, { status: 500 });
			}

			userSubs = (subsRaw || []) as typeof userSubs;
		}

		// 4. User directory for name/email — public_user_info no longer has email.
		const userIds = Array.from(new Set(appointments.map((a) => a.user_id)));
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

		// Index user_subs by `${user_id}-${subsidy_id}` for quick lookup.
		const userSubMap = new Map<string, (typeof userSubs)[number]>();
		userSubs.forEach((sub) => userSubMap.set(`${sub.user_id}-${sub.subsidy_id}`, sub));

		const members = appointments
			// Only include appointments whose position has an approved envelope today.
			.filter((appt) => envelopesByPosition.has(appt.position_id))
			.map((appt) => {
				const envelope = envelopesByPosition.get(appt.position_id);
				if (!envelope) return null;
				const userSub = userSubMap.get(`${appt.user_id}-${envelope.id}`);
				const directory = directoryMap.get(appt.user_id);
				const position = envelope.position ?? unwrapRelation(appt.cca_positions);

				const overrideHours = userSub?.hours ?? null;
				const effectiveHours = overrideHours ?? envelope.hours;

				return {
					id: appt.user_id,
					user_id: appt.user_id,
					position_id: appt.position_id,
					user_subsidy_id: userSub?.id ?? null,
					name: directory?.name || `User #${appt.user_id}`,
					email: directory?.email || "",
					role: position?.name || "Member",
					type: position?.position_type || "",
					has_approved_subsidy: true,
					submitted: !!userSub,
					hours: effectiveHours,
					override_hours: overrideHours,
					approved_hours: envelope.hours,
					comments: userSub?.comments ?? "",
					justification: envelope.justification ?? "",
					status: userSub?.status ?? null,
					rejection_reason: userSub?.rejection_reason ?? null,
				};
			})
			.filter((member): member is NonNullable<typeof member> => member !== null);

		return NextResponse.json(
			{ members },
			{
				headers: {
					"Cache-Control": "no-store, private",
				},
			},
		);
	} catch (error) {
		console.error("=== ERROR in GET weekly ===", error);
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

		const day = getWeekDay(weekIdNum);
		if (!day) {
			return NextResponse.json({ error: "Unknown week" }, { status: 400 });
		}

		const authResult = await authorizeChair(ccaId);
		if (!authResult.authorized) {
			return NextResponse.json({ error: authResult.message }, { status: authResult.status });
		}

		const body = await request.json();
		const declarations = (body?.declarations || []) as Array<{
			user_id: number;
			position_id: number;
			hours?: number | null;
			comments?: string | null;
		}>;
		const deletions = (body?.deletions || []) as Array<{
			user_id: number;
			position_id: number;
		}>;

		if (!Array.isArray(declarations) || !Array.isArray(deletions)) {
			return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
		}

		if (declarations.length === 0 && deletions.length === 0) {
			return NextResponse.json({ error: "No changes provided" }, { status: 400 });
		}

		for (const decl of declarations) {
			if (
				!decl ||
				typeof decl.user_id !== "number" ||
				typeof decl.position_id !== "number"
			) {
				return NextResponse.json(
					{ error: "Each declaration must include user_id and position_id" },
					{ status: 400 },
				);
			}
		}

		for (const del of deletions) {
			if (!del || typeof del.user_id !== "number" || typeof del.position_id !== "number") {
				return NextResponse.json(
					{ error: "Each deletion must include user_id and position_id" },
					{ status: 400 },
				);
			}
		}

		// Resolve approved envelopes for this CCA + day so we can address per-user
		// rows by subsidy_id (the new natural key under the schema). Without an
		// approved envelope, upsert_user_subsidy will fail at the trigger anyway,
		// but failing fast yields a clearer 4xx.
		const { data: envelopesRaw, error: envelopesError } = await supabase
			.from("cca_subsidies")
			.select(
				`id, position_id, status, cca_positions!inner (cca_id)`,
			)
			.eq("cca_positions.cca_id", ccaId)
			.eq("day", day)
			.eq("status", SubsidyStatus.APPROVED);

		if (envelopesError) {
			return NextResponse.json({ error: envelopesError.message }, { status: 500 });
		}

		type EnvelopeRow = { id: number; position_id: number; status: SubsidyStatus };
		const envelopes = (envelopesRaw || []) as EnvelopeRow[];
		const envelopeByPosition = new Map(envelopes.map((e) => [e.position_id, e]));

		// Optional sanity check: validate user/position pairs are CCA appointments
		// to provide a friendlier 400 than the RLS-driven trigger failure.
		const { data: appointmentsRaw, error: appointmentsError } = await supabase
			.from("cca_appointments")
			.select(`user_id, position_id, cca_positions!inner (cca_id)`)
			.eq("cca_positions.cca_id", ccaId);

		if (appointmentsError) {
			return NextResponse.json(
				{ error: "Failed to validate members for this CCA" },
				{ status: 500 },
			);
		}

		const validPairs = new Set(
			(appointmentsRaw || []).map(
				(appt: { user_id: number; position_id: number }) =>
					`${appt.user_id}-${appt.position_id}`,
			),
		);

		const invalidDeclarations = declarations.filter(
			(decl) => !validPairs.has(`${decl.user_id}-${decl.position_id}`),
		);
		const invalidDeletions = deletions.filter(
			(del) => !validPairs.has(`${del.user_id}-${del.position_id}`),
		);

		if (invalidDeclarations.length > 0 || invalidDeletions.length > 0) {
			return NextResponse.json(
				{ error: "One or more selections are invalid for this CCA" },
				{ status: 400 },
			);
		}

		// upsert_user_subsidy per declaration. It's SECURITY INVOKER + RLS-gated
		// on insert_managed, and the trigger enforces "parent must be approved"
		// for any non-rejected status. Per-row failure surfaces the most specific
		// trigger message rather than a swallowed bulk error.
		for (const decl of declarations) {
			const envelope = envelopeByPosition.get(decl.position_id);
			if (!envelope) {
				return NextResponse.json(
					{
						error:
							"Cannot save member commitment: no approved subsidy envelope exists for this position and week.",
					},
					{ status: 409 },
				);
			}

			const { error: rpcError } = await supabase.rpc("upsert_user_subsidy", {
				p_subsidy_id: envelope.id,
				p_user_id: decl.user_id,
				p_hours: decl.hours ?? null,
				p_comments: decl.comments ?? null,
			});

			if (rpcError) {
				const mapped = mapUserSubsidyError(rpcError.message);
				return NextResponse.json({ error: mapped.error }, { status: mapped.status });
			}
		}

		// Deletions: scoped to the envelopes resolved above so we don't reach
		// across CCAs or weeks even if the caller crafted bad input.
		for (const del of deletions) {
			const envelope = envelopeByPosition.get(del.position_id);
			if (!envelope) continue;

			const { error: deleteError } = await supabase
				.from("cca_user_subsidies")
				.delete()
				.eq("subsidy_id", envelope.id)
				.eq("user_id", del.user_id);

			if (deleteError) {
				const mapped = mapUserSubsidyError(deleteError.message);
				return NextResponse.json({ error: mapped.error }, { status: mapped.status });
			}
		}

		const savedCount = declarations.length;
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
