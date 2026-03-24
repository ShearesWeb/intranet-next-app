import { ReactNode } from "react";

import { ServiceDisabledState } from "@/components/feature-flags/service-disabled-state";
import { createClient } from "@/utils/supabase/server";
import { isCoreServiceEnabled } from "@/lib/feature-flags";

export default async function ManageCcaRankMembersLayout({ children }: { children: ReactNode }) {
    const supabase = await createClient();
    const { data: managedPositions, error } = await supabase
        .from("managed_cca_positions")
        .select("cca_name")
        .limit(1);

    if (error) {
        console.error("Error loading managed ranking positions:", error);
    }

    const isMemberRankingEnabled = isCoreServiceEnabled("memberRanking", {
        ccaName: managedPositions?.[0]?.cca_name,
    });

    if (!isMemberRankingEnabled) {
        return <ServiceDisabledState service="memberRanking" />;
    }

    return children;
}
