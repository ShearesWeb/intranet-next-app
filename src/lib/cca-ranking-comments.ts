export type RankingCommentFields = {
    attendance: number | null;
    performance: number | null;
    helpfulness: number | null;
    initiative: number | null;
    attitude: number | null;
    remarks: string | null;
};

type RankingCommentInput = Partial<RankingCommentFields>;

const parseNullableNumber = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
};

export function extractRankingCommentFields(comments: unknown): RankingCommentFields {
    if (!comments || typeof comments !== "object" || Array.isArray(comments)) {
        return {
            attendance: null,
            performance: null,
            helpfulness: null,
            initiative: null,
            attitude: null,
            remarks: null,
        };
    }

    const record = comments as Record<string, unknown>;
    const helpfulness = parseNullableNumber(record.helpfulness);
    const initiative = parseNullableNumber(record.initiative);
    const attitude = parseNullableNumber(record.attitude);
    const useLegacyBehavioralFallback =
        initiative !== null &&
        helpfulness === null &&
        attitude === null;

    return {
        attendance: parseNullableNumber(record.attendance),
        performance: parseNullableNumber(record.performance),
        helpfulness: useLegacyBehavioralFallback ? initiative : helpfulness,
        initiative,
        attitude: useLegacyBehavioralFallback ? initiative : attitude,
        remarks: typeof record.remarks === "string" ? record.remarks : null,
    };
}

export function buildRankingComments(fields: RankingCommentInput) {
    const comments: Record<string, number | string> = {};

    if (typeof fields.attendance === "number" && Number.isFinite(fields.attendance)) {
        comments.attendance = fields.attendance;
    }

    if (typeof fields.performance === "number" && Number.isFinite(fields.performance)) {
        comments.performance = fields.performance;
    }

    if (typeof fields.helpfulness === "number" && Number.isFinite(fields.helpfulness)) {
        comments.helpfulness = fields.helpfulness;
    }

    if (typeof fields.initiative === "number" && Number.isFinite(fields.initiative)) {
        comments.initiative = fields.initiative;
    }

    if (typeof fields.attitude === "number" && Number.isFinite(fields.attitude)) {
        comments.attitude = fields.attitude;
    }

    if (typeof fields.remarks === "string" && fields.remarks.trim() !== "") {
        comments.remarks = fields.remarks;
    }

    return comments;
}
