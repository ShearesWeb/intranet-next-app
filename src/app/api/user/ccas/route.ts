// src/app/api/user/ccas/route.ts
// API route to get CCAs a user is appointed to
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/api/auth";
import { apiOk, handleApiError } from "@/lib/api/response";
import { isManagingAppointment } from "@/lib/cca/cca-chair-access";
import { CcaKind } from "@/types/user";

type CCAMeta = {
	id: number;
	name: string;
	kind: CcaKind;
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
			.select("id, name, kind, description, image_url")
			.in("id", ccaIds);

		if (ccasError) {
			console.error("Error fetching CCA metadata:", ccasError);
			return apiOk([]);
		}

		const ccaMap = new Map<number, CCAMeta>((ccas || []).map((cca) => [cca.id, cca as CCAMeta]));

		const appointmentsByCca = new Map(
			appointments.map((appointment) => [appointment.cca_id, appointment]),
		);
		const appointmentsToTransform = includeAllAppointments
			? appointments
			: Array.from(appointmentsByCca.values());

		// `my_profile.appointments` already carries kind, points, commitment and
		// team status per appointment, so no secondary `cca_appointments` lookup
		// is needed. Only the CCA description and image come from `ccas`.
		const transformedData = appointmentsToTransform.map((appointment) => {
			const cca = ccaMap.get(appointment.cca_id);

			return {
				id: appointment.cca_id,
				name: cca?.name || appointment.cca_name,
				role: appointment.position_name,
				position_type: appointment.position_type,
				cca_kind: appointment.cca_kind ?? cca?.kind ?? "committee",
				description: cca?.description || "",
				points: appointment.points || 0,
				team_status: appointment.team_status ?? null,
				can_manage_members: isManagingAppointment(appointment),
			};
		});

		return apiOk(transformedData);
	} catch (e) {
		return handleApiError(e);
	}
}
