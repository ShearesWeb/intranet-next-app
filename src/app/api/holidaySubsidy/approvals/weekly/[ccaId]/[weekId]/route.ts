import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type Params = {
    params: Promise<{
        ccaId: string;
        weekId: string;
    }>;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function authorizeJCRC(supabase: Awaited<ReturnType<typeof createClient>>) {
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { authorized: false, message: "Not authenticated", status: 401 };
    }

    const { data: userRoles } = await supabase
        .from("authenticated_user_info")
        .select("is_jcrc, is_admin")
        .eq("id", user.id)
        .single();

    if (!userRoles || (!userRoles.is_jcrc && !userRoles.is_admin)) {
        return { authorized: false, message: "Not authorized. JCRC access only.", status: 403 };
    }

    return { authorized: true, message: "", status: 200 };
}

export async function GET(_request: Request, { params }: Params) {
    try {
        const supabase = await createClient();
        const { ccaId, weekId } = await params;
        const ccaIdNum = Number(ccaId);
        const weekIdNum = Number(weekId);

        if (isNaN(ccaIdNum) || isNaN(weekIdNum)) {
            return NextResponse.json({ error: "Invalid CCA ID or Week ID" }, { status: 400 });
        }

        // TODO: Re-enable authorization after testing
        // const authResult = await authorizeJCRC(supabase);
        // if (!authResult.authorized) {
        //     return NextResponse.json({ error: authResult.message }, { status: authResult.status });
        // }

        // Fetch all user_subsidies for this CCA and week with details
        // Use inner join on cca_positions to filter by CCA ID
        const { data: submissions, error: submissionsError } = await supabase
            .from("user_subsidies")
            .select(`
                user_id,
                position_id,
                hours,
                justification,
                comments,
                subsidy_status,
                cca_positions!inner (
                    id,
                    name,
                    position_type,
                    cca_id
                ),
                public_user_info (
                    id,
                    name,
                    email
                )
            `)
            .eq("cca_positions.cca_id", ccaIdNum)
            .eq("week_id", weekIdNum);

        if (submissionsError) {
            console.error("Submissions error:", submissionsError);
            return NextResponse.json({ error: submissionsError.message }, { status: 500 });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const submissionsData = submissions?.map((sub: any) => {
            const user = sub.public_user_info;
            const position = sub.cca_positions;

            return {
                id: `${sub.user_id}-${sub.position_id}`, // Composite ID for table
                user_id: sub.user_id,
                position_id: sub.position_id,
                name: user?.name || `User #${sub.user_id}`,
                email: user?.email || "",
                role: position?.name || "Member",
                type: position?.position_type || "",
                hours: sub.hours,
                justification: sub.justification || "",
                remarks: sub.comments || "",
                status: sub.subsidy_status || "pending",
            };
        }) || [];

        return NextResponse.json(
            { submissions: submissionsData },
            {
                headers: {
                    'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=30',
                },
            }
        );
    } catch (error) {
        console.error("Error fetching JCRC weekly approval data:", error);
        return NextResponse.json({ error: "Failed to load approval data" }, { status: 500 });
    }
}

export async function PATCH(request: Request, { params }: Params) {
    try {
        const supabase = await createClient();
        const { ccaId, weekId } = await params;
        const ccaIdNum = Number(ccaId);
        const weekIdNum = Number(weekId);

        if (isNaN(ccaIdNum) || isNaN(weekIdNum)) {
            return NextResponse.json({ error: "Invalid CCA ID or Week ID" }, { status: 400 });
        }

        // TODO: Re-enable authorization after testing
        // const authResult = await authorizeJCRC(supabase);
        // if (!authResult.authorized) {
        //     return NextResponse.json({ error: authResult.message }, { status: authResult.status });
        // }

        const body = await request.json();
        const { updates } = body as {
            updates: Array<{
                user_id: number;
                position_id: number;
                status: "approved" | "rejected";
            }>;
        };

        if (!updates || !Array.isArray(updates) || updates.length === 0) {
            return NextResponse.json({ error: "No updates provided" }, { status: 400 });
        }

        // Group updates by status to batch them
        const updatesByStatus = updates.reduce((acc, update) => {
            if (!acc[update.status]) acc[update.status] = [];
            acc[update.status].push(update);
            return acc;
        }, {} as Record<string, typeof updates>);

        const updatePromises = [];

        for (const [status, statusUpdates] of Object.entries(updatesByStatus)) {
            // Batch updates to avoid URL length limits
            const BATCH_SIZE = 20;
            for (let i = 0; i < statusUpdates.length; i += BATCH_SIZE) {
                const batch = statusUpdates.slice(i, i + BATCH_SIZE);
                // Construct OR filter: and(user_id.eq.1,position_id.eq.2),and(user_id.eq.3,position_id.eq.4)
                const orFilter = batch
                    .map(u => `and(user_id.eq.${u.user_id},position_id.eq.${u.position_id})`)
                    .join(',');

                updatePromises.push(
                    supabase
                        .from("user_subsidies")
                        .update({ subsidy_status: status })
                        .eq("week_id", weekIdNum)
                        .or(orFilter)
                );
            }
        }

        const results = await Promise.all(updatePromises);

        // Check for errors
        const errors = results.filter((r) => r.error);
        if (errors.length > 0) {
            console.error("Update errors:", errors);
            return NextResponse.json(
                { error: "Some updates failed", details: errors },
                { status: 500 }
            );
        }

        return NextResponse.json({
            message: `Successfully updated ${updates.length} submission(s)`,
            updated: updates.length,
        });
    } catch (error) {
        console.error("Error updating JCRC weekly approvals:", error);
        return NextResponse.json({ error: "Failed to update approvals" }, { status: 500 });
    }
}

