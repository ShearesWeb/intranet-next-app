// src/app/api/user/checkRole/route.ts
// API route to check if a user has lead/vice roles and return their positions
import { NextResponse } from "next/server";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { checkCcaAuthorization } from "@/features/cca/utils/cca-chair-access";
import { isCoreServiceEnabled } from "@/lib/feature-flags";

type UserPositionSummary = {
	position: string;
	position_type: string;
	cca: string;
};

export async function GET() {
	try {
		const headers = {
			"Cache-Control": "no-store, private",
			"Content-Type": "application/json",
		};

		if (!isCoreServiceEnabled("ccaApplications")) {
			return NextResponse.json({ isAuthorized: false, positions: [] }, { headers });
		}

		// Get full user info to check admin status
		const userInfo = await fetchUserInfo();

		if (!userInfo) {
			return NextResponse.json(
				{
					isAuthorized: false,
					positions: [],
				},
				{
					status: 401,
					headers,
				},
			);
		}

		// `checkCcaAuthorization` is async (see `cca-chair-access.ts`): with no
		// `cca` argument it short-circuits on the JWT fast path (no DB round-trip).
		const authResult = await checkCcaAuthorization({ requestingUser: userInfo });
		const userPositions: UserPositionSummary[] = (userInfo.appointments || []).map(
			(appointment) => ({
				position: appointment.position_name,
				position_type: appointment.position_type,
				cca: appointment.cca_name || "Unknown",
			}),
		);
		const roleResult = {
			isAuthorized: authResult.ok && authResult.data.hasChairAccess,
			positions: userPositions.map((pos) => `${pos.position} (${pos.position_type}) - ${pos.cca}`),
		};

		// Allow admins to access chair features.
		//
		// Note: under the new schema `is_admin` is *not* a stored flag on
		// `users`. It is derived per query from
		// `public.authenticated_user_roles` — true iff the caller holds a
		// position whose `reports_to` chain has subordinate positions. If a
		// user "had admin" before but now does not, check their position
		// reporting chain in `cca_positions` rather than searching for a
		// settable flag.
		// See: intranet-wiki/wiki/entity/view/public.authenticated_user_info.md
		if (userInfo.is_admin) {
			roleResult.isAuthorized = true;
			if (roleResult.positions.length === 0) {
				roleResult.positions.push("Administrator Access");
			}
		}

		return NextResponse.json(roleResult, { headers });
	} catch (error) {
		console.error("Error checking role:", error);
		return NextResponse.json(
			{ isAuthorized: false, positions: [] },
			{
				headers: {
					"Cache-Control": "no-store, private",
					"Content-Type": "application/json",
				},
			},
		);
	}
}
