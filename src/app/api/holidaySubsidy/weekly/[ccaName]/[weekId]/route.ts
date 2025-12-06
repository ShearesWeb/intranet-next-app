import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getWeekLabel, isWeekEditable } from "@/lib/holiday-subsidy-weeks";

type Params = {
    params: Promise<{
        ccaName: string;
        weekId: string;
    }>;
};

async function resolveCCAId(ccaName: string, supabase: Awaited<ReturnType<typeof createClient>>) {
    const decodedName = decodeURIComponent(ccaName);

    const { data, error } = await supabase
        .from("ccas")
        .select("id")
        .ilike("name", decodedName)
        .single();

    if (error || !data) {
        return { ccaId: null, error: error?.message || "CCA not found" };
    }

    return { ccaId: data.id, error: null };
}

export async function GET(_request: Request, { params }: Params) {
    try {
        const supabase = await createClient();
        const { ccaName, weekId } = await params;
        const weekIdNum = parseInt(weekId);

        if (isNaN(weekIdNum)) {
            return NextResponse.json({ error: "Invalid week ID" }, { status: 400 });
        }

        if (!isWeekEditable(weekIdNum)) {
            return NextResponse.json(
                { error: `Weekly declarations are closed for ${getWeekLabel(weekIdNum) || "this week"}.` },
                { status: 403 }
            );
        }

        if (!isWeekEditable(weekIdNum)) {
            return NextResponse.json(
                { error: `Weekly declarations are closed for ${getWeekLabel(weekIdNum) || "this week"}.` },
                { status: 403 }
            );
        }

        const { ccaId, error: ccaError } = await resolveCCAId(ccaName, supabase);

        if (!ccaId) {
            return NextResponse.json({ error: ccaError || "CCA not found" }, { status: 404 });
        }

        // Get all appointments with position and user details in one query
        const { data: appointments, error: appointmentsError } = await supabase
            .from("cca_appointments")
            .select(`
                user_id,
                position_id,
                cca_positions (
                    id,
                    position_type,
                    name
                ),
                public_user_info (
                    id,
                    name,
                    email
                )
            `)
            .eq("cca_id", ccaId);

        if (appointmentsError) {
            console.error("Appointments error:", appointmentsError);
            return NextResponse.json({
                error: `Failed to fetch appointments: ${appointmentsError.message}`,
                details: appointmentsError
            }, { status: 500 });
        }

        // Map the joined data to the expected structure
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const members = appointments?.map((appointment: any) => {
            const position = appointment.cca_positions;
            const user = appointment.public_user_info;

            return {
                id: appointment.user_id,
                user_id: appointment.user_id,
                position_id: appointment.position_id,
                position_type: position?.position_type || "",
                position_name: position?.name || "Member",
                user_name: user?.name || `User #${appointment.user_id}`,
                user_email: user?.email || ""
            };
        }) || [];

        // Get approved subsidies and existing submissions in parallel for better performance
        const subsidyPositionIds = appointments?.map((a) => a.position_id) || [];
        const submissionUserIds = appointments?.map((a) => a.user_id) || [];

        const [subsidiesResult, submissionsResult] = await Promise.all([
            supabase
                .from("subsidies")
                .select("position_id, hours, justification")
                .in("position_id", subsidyPositionIds)
                .eq("week_id", weekIdNum)
                .eq("subsidy_status", "approved"),
            supabase
                .from("user_subsidies")
                .select("user_id, position_id, hours, justification, comments, subsidy_status")
                .in("user_id", submissionUserIds)
                .in("position_id", subsidyPositionIds)
                .eq("week_id", weekIdNum),
        ]);

        if (subsidiesResult.error) {
            return NextResponse.json({ error: subsidiesResult.error.message }, { status: 500 });
        }

        if (submissionsResult.error) {
            return NextResponse.json({ error: submissionsResult.error.message }, { status: 500 });
        }

        const subsidies = subsidiesResult.data;
        const userSubmissions = submissionsResult.data;
        const approvedPositionIds = new Set(subsidies?.map((s) => s.position_id) || []);

        // Build response with pre-fill logic
        const subsidyMap = new Map(subsidies?.map((s) => [s.position_id, s]) || []);
        const submissionMap = new Map(
            userSubmissions?.map((s) => [`${s.user_id}-${s.position_id}`, s]) || []
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const membersData = members
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ?.map((member: any) => {
                const approvedSubsidy = subsidyMap.get(member.position_id);
                const submission = submissionMap.get(`${member.user_id}-${member.position_id}`);

                return {
                    id: member.user_id,
                    user_id: member.user_id,
                    position_id: member.position_id,
                    name: member.user_name || "Unknown",
                    email: member.user_email || "",
                    role: member.position_name || "Member",
                    type: member.position_type || "",

                    // Flags
                    has_approved_subsidy: !!approvedSubsidy,
                    submitted: !!submission,

                    // Data priority: submission > approved subsidy > empty
                    hours: submission?.hours ?? approvedSubsidy?.hours ?? 0,
                    justification: submission?.justification ?? approvedSubsidy?.justification ?? "",
                    remarks: submission?.comments ?? "",
                    status: submission?.subsidy_status ?? null,

                    // Template data
                    approved_hours: approvedSubsidy?.hours ?? null,
                    approved_justification: approvedSubsidy?.justification ?? null,
                };
            })
            // Only include members with an approved subsidy for the week
            .filter((member) => approvedPositionIds.has(member.position_id)) || [];

        return NextResponse.json(
            { members: membersData },
            {
                headers: {
                    'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=30',
                },
            }
        );
    } catch (error) {
        console.error("=== ERROR in GET ===");
        console.error("Error:", error);
        console.error("Stack:", error instanceof Error ? error.stack : "No stack trace");
        return NextResponse.json({
            error: "Failed to load weekly commitment data",
            message: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: Params) {
    try {
        const supabase = await createClient();
        const { ccaName, weekId } = await params;
        const weekIdNum = parseInt(weekId);

        if (isNaN(weekIdNum)) {
            return NextResponse.json({ error: "Invalid week ID" }, { status: 400 });
        }

        const { ccaId, error: ccaError } = await resolveCCAId(ccaName, supabase);

        if (!ccaId) {
            return NextResponse.json({ error: ccaError || "CCA not found" }, { status: 404 });
        }

        const body = await request.json();
        const { declarations, deletions } = body;

        if (!Array.isArray(declarations) || !Array.isArray(deletions)) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        if (declarations.length === 0 && deletions.length === 0) {
            return NextResponse.json({ error: "No changes provided" }, { status: 400 });
        }

        // Validate all declarations before inserting
        for (const decl of declarations) {
            if (!decl.user_id || !decl.position_id || decl.hours === undefined) {
                return NextResponse.json(
                    { error: "Each declaration must have user_id, position_id, and hours" },
                    { status: 400 }
                );
            }
        }

        // Validate deletions
        for (const del of deletions) {
            if (!del.user_id || !del.position_id) {
                return NextResponse.json(
                    { error: "Each deletion must have user_id and position_id" },
                    { status: 400 }
                );
            }
        }

        // Upsert all declarations
        const upsertData = declarations.map((decl) => ({
            user_id: decl.user_id,
            position_id: decl.position_id,
            week_id: weekIdNum,
            hours: decl.hours,
            justification: decl.justification || "",
            comments: decl.remarks || "",
            subsidy_status: "pending",
        }));

        const { data: appointments, error: appointmentsError } = await supabase
            .from("cca_appointments")
            .select("user_id, position_id")
            .eq("cca_id", ccaId);

        if (appointmentsError) {
            console.error("Appointments error:", appointmentsError);
            return NextResponse.json({ error: "Failed to validate members for this CCA" }, { status: 500 });
        }

        const validPairs = new Set(
            (appointments || []).map((appt) => `${appt.user_id}-${appt.position_id}`)
        );

        const invalidDeclarations = upsertData.filter(
            (decl) => !validPairs.has(`${decl.user_id}-${decl.position_id}`)
        );
        const invalidDeletions = deletions.filter(
            (del: { user_id: number; position_id: number }) =>
                !validPairs.has(`${del.user_id}-${del.position_id}`)
        );

        if (invalidDeclarations.length > 0 || invalidDeletions.length > 0) {
            return NextResponse.json(
                { error: "One or more selections are invalid for this CCA" },
                { status: 400 }
            );
        }

        const operations: PromiseLike<unknown>[] = [];

        if (upsertData.length > 0) {
            operations.push(
                supabase
                    .from("user_subsidies")
                    .upsert(upsertData, {
                        onConflict: "user_id,position_id,week_id",
                    })
                    .then(({ error }) => {
                        if (error) throw error;
                    })
            );
        }

        if (deletions.length > 0) {
            const deletionConditions = deletions
                .map(
                    (del) =>
                        `and(user_id.eq.${del.user_id},position_id.eq.${del.position_id})`
                )
                .join(",");

            operations.push(
                supabase
                    .from("user_subsidies")
                    .delete()
                    .eq("week_id", weekIdNum)
                    .or(deletionConditions)
                    .then(({ error }) => {
                        if (error) throw error;
                    })
            );
        }

        try {
            await Promise.all(operations);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to save changes";
            return NextResponse.json({ error: errorMessage }, { status: 500 });
        }

        const savedCount = upsertData.length;
        const deletedCount = deletions.length;

        return NextResponse.json(
            {
                success: true,
                message: `Saved ${savedCount} member commitment(s)${deletedCount ? `, deleted ${deletedCount}` : ""}`,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error saving weekly commitments:", error);
        return NextResponse.json({ error: "Failed to save weekly commitments" }, { status: 500 });
    }
}
