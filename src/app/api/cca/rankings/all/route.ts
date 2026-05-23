import { NextResponse } from "next/server";
import { getManagedCcaData } from "@/lib/managed-cca-data";
import { fetchUserInfo } from "@/lib/auth/fetch-user-info";
import { getCoreServiceDisabledApiResponse, isCoreServiceEnabled } from "@/lib/feature-flags";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
	try {
		const user = await fetchUserInfo();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const supabase = await createClient();
		const rows = await getManagedCcaData(supabase, user);
		const disabledResponse = getCoreServiceDisabledApiResponse("memberRanking", {
			isJcrc: user.is_jcrc,
		});

		if (disabledResponse) {
			return disabledResponse;
		}

		const visibleRows = rows.filter((row) =>
			isCoreServiceEnabled("memberRanking", {
				isJcrc: user.is_jcrc && Boolean(row.can_rank_members),
			}),
		);

		return NextResponse.json({ data: visibleRows });
	} catch (error) {
		console.error("Error fetching CCA ranking list:", error);
		return NextResponse.json({ error: "Failed to load CCAs" }, { status: 500 });
	}
}
