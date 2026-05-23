// src/app/api/user/check-role/route.ts
// API route to check if a user has lead/vice roles and return their positions
import { requireAuth } from "@/lib/api/auth";
import { apiOk, handleApiError } from "@/lib/api/response";
import { checkCcaAuthorization } from "@/features/cca/utils/cca-chair-access";
import { isCoreServiceEnabled } from "@/lib/feature-flags";

const CACHE_HEADERS = { "Cache-Control": "no-store, private" };

type UserPositionSummary = {
	position: string;
	position_type: string;
	cca: string;
};

export async function GET() {
	try {
		if (!isCoreServiceEnabled("ccaApplications")) {
			return apiOk({ isAuthorized: false, positions: [] }, 200, CACHE_HEADERS);
		}

		const userInfo = await requireAuth();

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
		if (userInfo.is_admin) {
			roleResult.isAuthorized = true;
			if (roleResult.positions.length === 0) {
				roleResult.positions.push("Administrator Access");
			}
		}

		return apiOk(roleResult, 200, CACHE_HEADERS);
	} catch (e) {
		return handleApiError(e);
	}
}
