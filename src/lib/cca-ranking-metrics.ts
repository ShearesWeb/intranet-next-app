export type RankingMetricKey = "attendance" | "performance" | "initiative";

type RankingMetricInput = Partial<Record<RankingMetricKey, number | null>>;

const normalizePositionType = (value?: string | null) =>
    (value || "").toLowerCase().replace(/[\s_-]+/g, "").trim();

const getMetricValue = (input: RankingMetricInput, key: RankingMetricKey) => {
    const value = input[key];
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
};

export const isResidentPositionType = (positionType?: string | null) =>
    normalizePositionType(positionType) === "resident";

export function getRankingMetricKeys({
    ccaType,
    positionType,
}: {
    ccaType?: string | null;
    positionType?: string | null;
}): RankingMetricKey[] {
    if (isResidentPositionType(positionType)) {
        return ["initiative"];
    }

    if (ccaType === "sports") {
        return ["attendance"];
    }

    return ["attendance", "performance"];
}

export function hasRequiredRankingInputs(
    input: RankingMetricInput,
    options: {
        ccaType?: string | null;
        positionType?: string | null;
    }
) {
    return getRankingMetricKeys(options).every((key) => getMetricValue(input, key) > 0);
}

export function getRankingScore(
    input: RankingMetricInput,
    options: {
        ccaType?: string | null;
        positionType?: string | null;
    }
) {
    return getRankingMetricKeys(options).reduce((total, key) => total + getMetricValue(input, key), 0);
}
