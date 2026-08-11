import { ReactNode } from "react";

import { ServiceDisabledState } from "@/components/feature-flags/service-disabled-state";
import { isCoreServiceEnabled } from "@/lib/feature-flags";

export default async function ManageCcaRankMembersLayout({ children }: { children: ReactNode }) {
	// No per-role override any more: `memberRanking` is parked for everyone,
	// JCRC included, because the evaluations table it reads no longer exists.
	if (!isCoreServiceEnabled("memberRanking")) {
		return <ServiceDisabledState service="memberRanking" />;
	}

	return children;
}
