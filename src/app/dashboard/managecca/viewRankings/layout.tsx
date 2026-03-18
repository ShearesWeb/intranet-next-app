import { ReactNode } from "react";

import { ServiceDisabledState } from "@/components/feature-flags/service-disabled-state";
import { isCoreServiceEnabled } from "@/lib/feature-flags";

export default function ManageCcaViewRankingsLayout({ children }: { children: ReactNode }) {
    if (!isCoreServiceEnabled("memberRanking")) {
        return <ServiceDisabledState service="memberRanking" />;
    }

    return children;
}

