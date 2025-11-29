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

        // Fetch all user_subsidies for this CCA and week
        // We need to join with cca_appointments to filter by CCA
        const { data: appointments, error: appointmentsError } = await supabase
            .from("cca_appointments")
            .select("user_id, position_id")
            .eq("cca_id", ccaIdNum);

        if (appointmentsError) {
            console.error("Appointments error:", appointmentsError);
            return NextResponse.json({ error: appointmentsError.message }, { status: 500 });
        }

        if (!appointments || appointments.length === 0) {
            return NextResponse.json({ submissions: [] });
        }

        // Get user_subsidies for these appointments and this week
        const userIds = appointments.map((a) => a.user_id);
        const positionIds = appointments.map((a) => a.position_id);

        const { data: submissions, error: submissionsError } = await supabase
            .from("user_subsidies")
            .select("user_id, position_id, hours, justification, comments, subsidy_status")
            .in("user_id", userIds)
            .in("position_id", positionIds)
            .eq("week_id", weekIdNum);

        if (submissionsError) {
            console.error("Submissions error:", submissionsError);
            return NextResponse.json({ error: submissionsError.message }, { status: 500 });
        }

        // Fetch user and position details in parallel for better performance
        const [usersResult, positionsResult] = await Promise.all([
            supabase
                .from("public_user_info")
                .select("id, name, email")
                .in("id", userIds),
            supabase
                .from("cca_positions")
                .select("id, name, position_type")
                .in("id", positionIds),
        ]);

        if (usersResult.error) {
            console.error("Users error:", usersResult.error);
            return NextResponse.json({ error: usersResult.error.message }, { status: 500 });
        }

        if (positionsResult.error) {
            console.error("Positions error:", positionsResult.error);
            return NextResponse.json({ error: positionsResult.error.message }, { status: 500 });
        }

        const users = usersResult.data;
        const positions = positionsResult.data;

        // Create lookup maps
        const userMap = new Map(users?.map((u) => [u.id, u]) || []);
        const positionMap = new Map(positions?.map((p) => [p.id, p]) || []);

        // Combine data
        const submissionsData = submissions?.map((sub) => {
            const user = userMap.get(sub.user_id);
            const position = positionMap.get(sub.position_id);

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

        // Update each user_subsidy status
        const updatePromises = updates.map(({ user_id, position_id, status }) =>
            supabase
                .from("user_subsidies")
                .update({ subsidy_status: status })
                .eq("user_id", user_id)
                .eq("position_id", position_id)
                .eq("week_id", weekIdNum)
        );

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

