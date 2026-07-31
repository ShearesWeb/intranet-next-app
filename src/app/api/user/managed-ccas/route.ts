// src/app/api/user/managed-ccas/route.ts
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/api/auth";
import { apiOk, handleApiError } from "@/lib/api/response";
import { getManagedCcaData } from "@/lib/managed-cca-data";

export async function GET() {
	try {
		const user = await requireAuth();
		const supabase = await createClient();
		const data = await getManagedCcaData(supabase, user);
		return apiOk(data);
	} catch (e) {
		return handleApiError(e);
	}
}
