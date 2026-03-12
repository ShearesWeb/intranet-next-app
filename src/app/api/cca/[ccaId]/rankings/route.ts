// src/app/api/cca/[ccaId]/rankings/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchUserId, fetchUserInfo } from "@/lib/fetch-user-info";
import { checkCCAChairAuthorization } from "@/lib/lead-auth-service";
import { canJcrcAccessCca } from "@/lib/jcrc-cca-access";

type AppointmentPositionRow = {
    id: number;
    name: string;
    position_type: string;
    cca_id: number;
};

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

type UserAppointmentRow = {
    cca_positions: AppointmentPositionRow | AppointmentPositionRow[] | null;
};

type RankingRow = {
    user_id: number;
    position_id: number;
    ranking: number | null;
    attendance: number | null;
    performance: number | null;
    remarks: string | null;
};

type RankingPayload = {
    user_id: number;
    position_id: number;
    ranking: number;
    attendance: number;
    performance: number;
    remarks?: string | null;
};

const normalizeCommitteePositionName = (name?: string) => {
    return (name || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

const getCommitteeFirstWord = (name?: string) => {
    const normalized = normalizeCommitteePositionName(name);
    if (!normalized) return '';
    return normalized.split(' ')[0] || '';
};

const UNIVERSAL_EXCLUDED_POSITION_TYPES = new Set(['lead', 'vice']);
const COMMITTEE_EXCLUDED_POSITION_TYPES = new Set(['lead', 'vice', 'member']);
const RESIDENT_POSITION_TOKENS = new Set(['resident', 'residents']);
const SPORTS_RANKABLE_POSITION_TOKENS = new Set(['teammanager', 'tm', 'member', 'members']);
const PERFORMANCE_REQUIRED_CCA_TYPES = new Set(['committee', 'culture']);

const normalizePositionToken = (value?: string) =>
    (value || '').toLowerCase().replace(/[\s_-]+/g, '').trim();

const isResidentPosition = (position?: { position_type?: string; name?: string } | null) => {
    if (!position) return false;
    const typeToken = normalizePositionToken(position.position_type);
    const nameToken = normalizePositionToken(position.name);
    return RESIDENT_POSITION_TOKENS.has(typeToken) || RESIDENT_POSITION_TOKENS.has(nameToken);
};

const isSportsRankablePosition = (position?: { position_type?: string; name?: string } | null) => {
    if (!position) return false;
    if (isResidentPosition(position)) return false;
    const typeToken = normalizePositionToken(position.position_type);
    const nameToken = normalizePositionToken(position.name);
    return SPORTS_RANKABLE_POSITION_TOKENS.has(typeToken) || SPORTS_RANKABLE_POSITION_TOKENS.has(nameToken);
};

const getMatchedCommitteeSubcommPositions = (
    positions: AppointmentPositionRow[],
    maincommFirstWords: string[]
) => {
    if (maincommFirstWords.length === 0) {
        return [] as AppointmentPositionRow[];
    }

    return positions.filter((position) => {
        if (position.position_type !== 'subcomm') return false;
        const normalizedName = normalizeCommitteePositionName(position.name);
        return maincommFirstWords.some((firstWord) =>
            normalizedName === firstWord || normalizedName.startsWith(`${firstWord} `)
        );
    });
};

// GET handler to fetch members with their ranking data
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ ccaId: string }> }
) {
    const { ccaId } = await params;
    const supabase = await createClient();
    const requestingUser = await fetchUserInfo();
    const requestingUserId = requestingUser?.id ?? null;
    const isJcrcViewer = Boolean(requestingUser?.is_jcrc);
    const isAdminViewer = Boolean(requestingUser?.is_admin);

    if (!requestingUserId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: ccaInfo, error: ccaError } = await supabase
        .from('ccas')
        .select('name, cca_type')
        .eq('id', ccaId)
        .single();

    if (ccaError || !ccaInfo) {
        return NextResponse.json({ error: 'CCA not found' }, { status: 404 });
    }

    const { data: userAppointments, error: userAppointmentsError } = await supabase
        .from('cca_appointments')
        .select(`
            cca_positions!inner(id, name, position_type, cca_id)
        `)
        .eq('user_id', requestingUserId)
        .eq('cca_positions.cca_id', ccaId);

    if (userAppointmentsError) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const normalizedUserPositions = ((userAppointments || []) as UserAppointmentRow[]).map((appointment) => {
        const position = Array.isArray(appointment.cca_positions)
            ? appointment.cca_positions[0]
            : appointment.cca_positions;
        return position;
    }).filter((position): position is AppointmentPositionRow => Boolean(position));

    const isCommittee = ccaInfo.cca_type === 'committee';
    const isSports = ccaInfo.cca_type === 'sports';
    const isChair = normalizedUserPositions.some((position) => ['lead', 'vice'].includes(position.position_type));
    const isMaincomm = normalizedUserPositions.some((position) => position.position_type === 'maincomm');
    const maincommFirstWords = normalizedUserPositions
        .filter((position) => position.position_type === 'maincomm')
        .map((position) => getCommitteeFirstWord(position.name))
        .filter((firstWord: string) => firstWord.length > 0);

    const hasJcrcMappedAccess = Boolean(
        requestingUser && isJcrcViewer && canJcrcAccessCca(requestingUser, ccaInfo.name)
    );
    const hasAdminAppointmentAccess = isAdminViewer && normalizedUserPositions.length > 0;

    let hasChairAccess = false;
    if (isCommittee) {
        hasChairAccess = isChair || isMaincomm;
    } else {
        const authResult = await checkCCAChairAuthorization(requestingUserId, parseInt(ccaId), supabase);
        hasChairAccess = authResult.authorized;
    }

    if (!hasJcrcMappedAccess && !hasAdminAppointmentAccess && !hasChairAccess) {
        return NextResponse.json(
            { error: 'You are not authorized to view rankings for this CCA' },
            { status: 403 }
        );
    }

    const { data: members, error: membersError } = await supabase
        .from('cca_appointments')
        .select(`
            user_id,
            cut_status,
            commitment_period,
            public_user_info!inner(id, name),
            cca_positions!inner(id, name, position_type, cca_id)
        `)
        .eq('cca_positions.cca_id', ccaId);

    if (membersError) {
        console.error("Error fetching rankings:", membersError);
        return NextResponse.json({ error: "Failed to fetch rankings." }, { status: 500 });
    }

    if (!members || members.length === 0) {
        return NextResponse.json({ members: [] });
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
        .select('user_id, position_id, ranking, attendance, performance, remarks')
        .in('position_id', positionIds)
        .in('user_id', userIds);

    if (rankingsError) {
        console.error("Error fetching rankings:", rankingsError);
        return NextResponse.json({ error: "Failed to fetch rankings." }, { status: 500 });
    }

    const rankingsMap = new Map<string, { ranking?: number | null; attendance?: number | null; performance?: number | null; remarks?: string | null }>();
    (rankings as RankingRow[] | null | undefined)?.forEach((ranking) => {
        rankingsMap.set(`${ranking.user_id}:${ranking.position_id}`, ranking);
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

    let scopedMembers = enrichedMembers;

    if (isCommittee && (isChair || isMaincomm)) {
        scopedMembers = scopedMembers.filter((member) => {
            const position = member.cca_positions;
            if (!position) return false;
            if (isChair) {
                return ['maincomm', 'blockcomm'].includes(position.position_type);
            }
            return getMatchedCommitteeSubcommPositions([position], maincommFirstWords).length > 0;
        });
    }

    if (isCommittee) {
        scopedMembers = scopedMembers.filter((member) => {
            const positionType = member.cca_positions?.position_type?.toLowerCase() || '';
            return !COMMITTEE_EXCLUDED_POSITION_TYPES.has(positionType);
        });
    }

    if (isSports) {
        scopedMembers = scopedMembers.filter((member) => {
            return isSportsRankablePosition(member.cca_positions ?? undefined);
        });
    }

    scopedMembers = scopedMembers.filter((member) => {
        const positionType = member.cca_positions?.position_type?.toLowerCase() || '';
        return !UNIVERSAL_EXCLUDED_POSITION_TYPES.has(positionType) && !isResidentPosition(member.cca_positions ?? undefined);
    });

    scopedMembers.sort((a, b) => {
        const aRanking = a.cca_member_rankings?.[0]?.ranking ?? Number.MAX_SAFE_INTEGER;
        const bRanking = b.cca_member_rankings?.[0]?.ranking ?? Number.MAX_SAFE_INTEGER;
        if (aRanking !== bRanking) return aRanking - bRanking;
        return a.public_user_info?.name?.localeCompare(b.public_user_info?.name || '') ?? 0;
    });

    return NextResponse.json({ members: scopedMembers, cca_type: ccaInfo.cca_type });
}

// POST handler to save (upsert) member rankings
export async function POST(
    request: Request,
    { params }: { params: Promise<{ ccaId: string }> }
) {
    const { ccaId } = await params;
    const rankings = (await request.json()) as RankingPayload[];
    const supabase = await createClient();
    const requestingUserId = await fetchUserId();

    if (!requestingUserId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: ccaInfo, error: ccaError } = await supabase
        .from('ccas')
        .select('cca_type')
        .eq('id', ccaId)
        .single();

    if (ccaError || !ccaInfo) {
        return NextResponse.json({ error: 'CCA not found' }, { status: 404 });
    }

    const { data: userAppointments, error: userAppointmentsError } = await supabase
        .from('cca_appointments')
        .select(`
            cca_positions!inner(id, name, position_type, cca_id)
        `)
        .eq('user_id', requestingUserId)
        .eq('cca_positions.cca_id', ccaId);

    if (userAppointmentsError) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const normalizedUserPositions = ((userAppointments || []) as UserAppointmentRow[]).map((appointment) => {
        const position = Array.isArray(appointment.cca_positions)
            ? appointment.cca_positions[0]
            : appointment.cca_positions;
        return position;
    }).filter((position): position is AppointmentPositionRow => Boolean(position));

    const isCommittee = ccaInfo.cca_type === 'committee';
    const isSports = ccaInfo.cca_type === 'sports';
    const requiresPerformance = PERFORMANCE_REQUIRED_CCA_TYPES.has(ccaInfo.cca_type || '');
    const isChair = normalizedUserPositions.some((position) => ['lead', 'vice'].includes(position.position_type));
    const isMaincomm = normalizedUserPositions.some((position) => position.position_type === 'maincomm');
    const maincommFirstWords = normalizedUserPositions
        .filter((position) => position.position_type === 'maincomm')
        .map((position) => getCommitteeFirstWord(position.name))
        .filter((firstWord: string) => firstWord.length > 0);

    if (!isCommittee) {
        const authResult = await checkCCAChairAuthorization(requestingUserId, parseInt(ccaId), supabase);
        if (!authResult.authorized) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }
    } else if (!isChair && !isMaincomm) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { data: positions, error: positionsError } = await supabase
        .from('cca_positions')
        .select('id, name, position_type, cca_id')
        .eq('cca_id', ccaId);

    if (positionsError) {
        return NextResponse.json({ error: 'Failed to load positions' }, { status: 500 });
    }

    const allowedPositionIds = new Set<number>();
    const committeePositions = (positions || []) as AppointmentPositionRow[];

    committeePositions.forEach((position) => {
        const positionType = position.position_type?.toLowerCase() || '';
        if (UNIVERSAL_EXCLUDED_POSITION_TYPES.has(positionType)) {
            return;
        }
        if (isResidentPosition(position)) {
            return;
        }
        if (!isCommittee) {
            if (isSports && !isSportsRankablePosition(position)) {
                return;
            }
            allowedPositionIds.add(position.id);
            return;
        }
        if (isChair) {
            if (['maincomm', 'blockcomm'].includes(position.position_type)) {
                allowedPositionIds.add(position.id);
            }
            return;
        }
    });

    if (isCommittee && !isChair) {
        const matchedSubcomm = getMatchedCommitteeSubcommPositions(committeePositions, maincommFirstWords);
        matchedSubcomm.forEach((position) => allowedPositionIds.add(position.id));
    }

    const rankingsToUpsert = rankings
        .filter((r) => allowedPositionIds.has(r.position_id))
        .filter((r) => {
            if (r.attendance <= 0) return false;
            if (requiresPerformance) return r.performance > 0;
            return true;
        })
        .map((r) => ({
            user_id: r.user_id,
            position_id: r.position_id,
            ranking: r.ranking,
            attendance: r.attendance,
            performance: requiresPerformance ? r.performance : (r.performance > 0 ? r.performance : r.attendance),
            remarks: r.remarks,
        }));

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
