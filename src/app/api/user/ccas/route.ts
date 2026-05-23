// src/app/api/user/ccas/route.ts
// API route to get CCAs a user is appointed to
import { createClient } from "@/lib/supabase/server";
import { isCoreServiceEnabled } from "@/lib/feature-flags";
import { requireAuth } from "@/lib/api/auth";
import { apiOk, handleApiError } from "@/lib/api/response";
import { isChairPositionType } from "@/features/cca/utils/cca-chair-access";
import { getManagedCcaData } from "@/lib/managed-cca-data";
import { CcaType } from "@/types/user";

type CCAMeta = {
	id: number;
	name: string;
	cca_type: CcaType;
	description: string;
	image_url: string | null;
};

export async function GET(request: Request) {
	try {
		const supabase = await createClient();
		const { searchParams } = new URL(request.url);
		const includeAllAppointments = searchParams.get("includeAllAppointments") === "true";

		const user = await requireAuth();

		const appointments = user.appointments || [];

		if (!appointments.length) {
			return apiOk([]);
		}

		const ccaIds = Array.from(new Set(appointments.map((appointment) => appointment.cca_id)));

		const { data: ccas, error: ccasError } = await supabase
			.from("ccas")
			.select("id, name, cca_type, description, image_url")
			.in("id", ccaIds);

		if (ccasError) {
			console.error("Error fetching CCA metadata:", ccasError);
			return apiOk([]);
		}

		const ccaMap = new Map<number, CCAMeta>((ccas || []).map((cca) => [cca.id, cca as CCAMeta]));

		const rankableCcaIds = new Set<number>();

		try {
			const managedCcas = await getManagedCcaData(supabase, user);
			managedCcas.forEach((managedCca) => {
				if (
					isCoreServiceEnabled("memberRanking", {
						isJcrc: user.is_jcrc && Boolean(managedCca.can_rank_members),
					})
				) {
					rankableCcaIds.add(managedCca.cca_id);
				}
			});
		} catch (managedCcaError) {
			console.error("Error fetching managed CCA positions:", managedCcaError);
		}

		const appointmentsByCca = new Map(
			appointments.map((appointment) => [appointment.cca_id, appointment]),
		);
		const appointmentsToTransform = includeAllAppointments
			? appointments
			: Array.from(appointmentsByCca.values());

		// `cut_status` is now projected on each appointment by
		// `public.authenticated_user_appointments` (see
		// `view/core/03.authenticated-user-info.sql`), so the previous secondary
		// `cca_appointments` lookup is redundant.
		const transformedData = appointmentsToTransform.map((appointment) => {
			const cca = ccaMap.get(appointment.cca_id);

			return {
				id: appointment.cca_id,
				name: cca?.name || appointment.cca_name,
				role: appointment.position_name,
				position_type: appointment.position_type,
				cca_type: cca?.cca_type || "committee",
				description: cca?.description || "",
				points: appointment.points || 0,
				cut_status: appointment.cut_status ?? null,
				can_manage_members: isChairPositionType(appointment.position_type),
				can_rank_members: rankableCcaIds.has(appointment.cca_id),
			};
		});

		return apiOk(transformedData);
	} catch (e) {
		return handleApiError(e);
	}
}
