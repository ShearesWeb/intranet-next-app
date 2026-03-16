export type RankingCommentFields = {
    attendance: number | null;
    performance: number | null;
    initiative: number | null;
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
            initiative: null,
            remarks: null,
        };
    }

    const record = comments as Record<string, unknown>;

    return {
        attendance: parseNullableNumber(record.attendance),
        performance: parseNullableNumber(record.performance),
        initiative: parseNullableNumber(record.initiative),
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

    if (typeof fields.initiative === "number" && Number.isFinite(fields.initiative)) {
        comments.initiative = fields.initiative;
    }

    if (typeof fields.remarks === "string" && fields.remarks.trim() !== "") {
        comments.remarks = fields.remarks;
    }

    return comments;
}
