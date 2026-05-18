import { ReactNode } from "react";

import { ServiceDisabledState } from "@/components/feature-flags/service-disabled-state";
import { isCoreServiceEnabled } from "@/lib/feature-flags";

export default function CcaAllocationLayout({ children }: { children: ReactNode }) {
	if (!isCoreServiceEnabled("ccaApplications")) {
		return <ServiceDisabledState service="ccaApplications" />;
	}

	return children;
}
