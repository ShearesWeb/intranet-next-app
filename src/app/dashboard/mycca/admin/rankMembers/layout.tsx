import { ReactNode } from "react";

import { ServiceDisabledState } from "@/components/feature-flags/service-disabled-state";
import { isCoreServiceEnabled } from "@/lib/feature-flags";
import { fetchUserInfo } from "@/lib/fetch-user-info";

export default async function ManageCcaRankMembersLayout({ children }: { children: ReactNode }) {
    const user = await fetchUserInfo();

    const isMemberRankingEnabled = isCoreServiceEnabled("memberRanking", {
        isJcrc: user?.is_jcrc,
    });

    if (!isMemberRankingEnabled) {
        return <ServiceDisabledState service="memberRanking" />;
    }

    return children;
}
