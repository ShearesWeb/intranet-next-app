// src/app/api/cca/[ccaId]/rankings/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { buildRankingComments, extractRankingCommentFields } from "@/lib/cca-ranking-comments";
import { getRankingMetricKeys, hasRequiredRankingInputs, isResidentPositionType } from "@/lib/cca-ranking-metrics";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import {
    checkCcaAuthorization,
    RankingAccessPosition,
} from "@/lib/cca-rankings-access";

type AppointmentPositionRow = RankingAccessPosition;

type AppointmentUserRow = {
    id: number;
    name: string;
};

type AppointmentRow = {
    user_id: number;
    cut_status: string | null;
    commitment_period: string | null;
    public_user_info: AppointmentUserRow | AppointmentUserRow[] | null;
    cca_positions: AppointmentPositionRow | AppointmentPositionRow[] | null;
};

type RankingRow = {
    user_id: number;
    position_id: number;
    ranking: number | null;
    comments: unknown | null;
};

type RankingPayload = {
    user_id: number;
    position_id: number;
    ranking: number;
    attendance: number;
    performance: number;
    initiative: number;
    remarks?: string | null;
};

async function loadCcaContext(supabase: Awaited<ReturnType<typeof createClient>>, ccaId: number) {
    const [{ data: cca, error: ccaError }, { data: positions, error: positionsError }] = await Promise.all([
        supabase
            .from("ccas")
            .select("id, name, cca_type")
            .eq("id", ccaId)
            .single(),
        supabase
            .from("cca_positions")
            .select("id, name, position_type, cca_id")
            .eq("cca_id", ccaId),
    ]);

    return { cca, ccaError, positions, positionsError };
}

// GET handler to fetch members with their ranking data
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ ccaId: string }> }
) {
    const { ccaId: ccaIdParam } = await params;
    const ccaId = Number(ccaIdParam);
    const supabase = await createClient();
    const requestingUser = await fetchUserInfo();
    const { cca, ccaError, positions, positionsError } = await loadCcaContext(supabase, ccaId);

    if (ccaError || !cca) {
        return NextResponse.json({ error: "CCA not found" }, { status: 404 });
    }

    if (positionsError) {
        return NextResponse.json({ error: "Failed to load positions" }, { status: 500 });
    }

    const accessResult = checkCcaAuthorization({
        requestingUser,
        cca,
        positions: (positions || []) as AppointmentPositionRow[],
        require: "access",
    });

    if (!accessResult.ok) {
        return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
    }

    const rankablePositionIds = accessResult.data.positions
        .filter((position) => position.canRank)
        .map((position) => position.id);

    if (!requestingUser?.is_admin && !requestingUser?.is_jcrc && rankablePositionIds.length === 0) {
        return NextResponse.json({ members: [], cca_type: cca.cca_type });
    }

    let membersQuery = supabase
        .from('cca_appointments')
        .select(`
            user_id,
            cut_status,
            commitment_period,
            public_user_info!inner(id, name),
            cca_positions!inner(id, name, position_type, cca_id)
        `)
        .eq('cca_positions.cca_id', ccaId);

    if (!requestingUser?.is_admin && !requestingUser?.is_jcrc) {
        membersQuery = membersQuery.in('position_id', rankablePositionIds);
    }

    const { data: members, error: membersError } = await membersQuery;

    if (membersError) {
        console.error("Error fetching rankings:", membersError);
        return NextResponse.json({ error: "Failed to fetch rankings." }, { status: 500 });
    }

    if (!members || members.length === 0) {
        return NextResponse.json({ members: [], cca_type: cca.cca_type });
    }

    const normalizedMembers = ((members || []) as AppointmentRow[]).map((member) => {
        const position = Array.isArray(member.cca_positions) ? member.cca_positions[0] : member.cca_positions;
        const userInfo = Array.isArray(member.public_user_info) ? member.public_user_info[0] : member.public_user_info;
        return {
            ...member,
            cca_positions: position,
            public_user_info: userInfo,
        };
    });

    const positionIds = normalizedMembers
        .map((member) => member.cca_positions?.id)
        .filter((id: number | undefined): id is number => typeof id === 'number');

    const userIds = normalizedMembers
        .map((member) => member.user_id)
        .filter((id: number | undefined): id is number => typeof id === 'number');

    const { data: rankings, error: rankingsError } = await supabase
        .from('cca_member_rankings')
        .select('user_id, position_id, ranking, comments')
        .in('position_id', positionIds)
        .in('user_id', userIds);

    if (rankingsError) {
        console.error("Error fetching rankings:", rankingsError);
        return NextResponse.json({ error: "Failed to fetch rankings." }, { status: 500 });
    }

    const rankingsMap = new Map<string, {
        ranking?: number | null;
        attendance?: number | null;
        performance?: number | null;
        initiative?: number | null;
        remarks?: string | null;
    }>();
    (rankings as RankingRow[] | null | undefined)?.forEach((ranking) => {
        const parsedComments = extractRankingCommentFields(ranking.comments);
        rankingsMap.set(`${ranking.user_id}:${ranking.position_id}`, {
            ranking: ranking.ranking,
            attendance: parsedComments.attendance,
            performance: parsedComments.performance,
            initiative: parsedComments.initiative,
            remarks: parsedComments.remarks,
        });
    });

    const enrichedMembers = normalizedMembers.map((member) => {
        const positionId = member.cca_positions?.id;
        const rankingKey = `${member.user_id}:${positionId}`;
        const ranking = rankingsMap.get(rankingKey);

        return {
            ...member,
            cca_member_rankings: ranking ? [ranking] : [],
        };
    });

    const scopedMembers = (!requestingUser?.is_admin && !requestingUser?.is_jcrc)
        ? enrichedMembers.filter((member) => {
            const positionId = member.cca_positions?.id;
            return typeof positionId === "number" && rankablePositionIds.includes(positionId);
        })
        : enrichedMembers;

    scopedMembers.sort((a, b) => {
        const aRanking = a.cca_member_rankings?.[0]?.ranking ?? Number.MAX_SAFE_INTEGER;
        const bRanking = b.cca_member_rankings?.[0]?.ranking ?? Number.MAX_SAFE_INTEGER;
        if (aRanking !== bRanking) return aRanking - bRanking;
        return a.public_user_info?.name?.localeCompare(b.public_user_info?.name || '') ?? 0;
    });

    return NextResponse.json({ members: scopedMembers, cca_type: cca.cca_type });
}

// POST handler to save (upsert) member rankings
export async function POST(
    request: Request,
    { params }: { params: Promise<{ ccaId: string }> }
) {
    const { ccaId: ccaIdParam } = await params;
    const ccaId = Number(ccaIdParam);
    const rankings = (await request.json()) as RankingPayload[];
    const supabase = await createClient();
    const requestingUser = await fetchUserInfo();
    const { cca, ccaError, positions, positionsError } = await loadCcaContext(supabase, ccaId);

    if (ccaError || !cca) {
        return NextResponse.json({ error: "CCA not found" }, { status: 404 });
    }

    if (positionsError) {
        return NextResponse.json({ error: 'Failed to load positions' }, { status: 500 });
    }

    const accessResult = checkCcaAuthorization({
        requestingUser,
        cca,
        positions: (positions || []) as AppointmentPositionRow[],
        require: "rank",
    });

    if (!accessResult.ok) {
        return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
    }

    const allowedPositionIds = requestingUser?.is_admin
        ? new Set(((positions || []) as AppointmentPositionRow[]).map((position) => position.id))
        : new Set(
            accessResult.data.positions
                .filter((position) => position.canRank)
                .map((position) => position.id)
        );
    const positionTypeById = new Map<number, string | null>(
        ((positions || []) as AppointmentPositionRow[]).map((position) => [position.id, position.position_type || null])
    );

    const rankingsToUpsert = rankings
        .filter((ranking) => allowedPositionIds.has(ranking.position_id))
        .filter((ranking) => {
            const positionType = positionTypeById.get(ranking.position_id);

            return hasRequiredRankingInputs(
                {
                    attendance: ranking.attendance,
                    performance: ranking.performance,
                    initiative: ranking.initiative,
                },
                {
                    ccaType: cca.cca_type,
                    positionType,
                }
            );
        })
        .map((ranking) => {
            const positionType = positionTypeById.get(ranking.position_id);
            const rankingMetricKeys = getRankingMetricKeys({
                ccaType: cca.cca_type,
                positionType,
            });
            const normalizedPerformance = accessResult.data.requiresPerformance
                ? ranking.performance
                : (ranking.performance > 0 ? ranking.performance : ranking.attendance);
            const comments = isResidentPositionType(positionType)
                ? buildRankingComments({
                    initiative: ranking.initiative,
                    remarks: ranking.remarks,
                })
                : buildRankingComments({
                    attendance: ranking.attendance,
                    performance: rankingMetricKeys.includes("performance")
                        ? ranking.performance
                        : normalizedPerformance,
                    remarks: ranking.remarks,
                });

            return {
                user_id: ranking.user_id,
                position_id: ranking.position_id,
                ranking: ranking.ranking,
                comments,
            };
        });

    if (rankingsToUpsert.length === 0) {
        return NextResponse.json({ success: true, message: "No valid rankings to save" });
    }

    const { error } = await supabase
        .from('cca_member_rankings')
        .upsert(rankingsToUpsert, { onConflict: 'user_id, position_id' });

    if (error) {
        console.error("Error saving rankings:", error);
        return NextResponse.json({ error: "Failed to save rankings." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
