import { ReactNode } from "react";

import { ServiceDisabledState } from "@/components/feature-flags/service-disabled-state";
import { isCoreServiceEnabled } from "@/lib/feature-flags";
import { RankingPeriodsProvider } from "@/lib/timed-flags/ranking-periods-context";

export default function CcaAllocationLayout({ children }: { children: ReactNode }) {
	if (!isCoreServiceEnabled("ccaApplications")) {
		return <ServiceDisabledState service="ccaApplications" />;
	}

	return <RankingPeriodsProvider>{children}</RankingPeriodsProvider>;
}
