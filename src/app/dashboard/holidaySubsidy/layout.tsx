import { ReactNode } from "react";

import { ServiceDisabledState } from "@/components/feature-flags/service-disabled-state";
import { isCoreServiceEnabled } from "@/lib/feature-flags";

export default function HolidaySubsidyLayout({ children }: { children: ReactNode }) {
	if (!isCoreServiceEnabled("holidaySubsidy")) {
		return <ServiceDisabledState service="holidaySubsidy" />;
	}

	return children;
}
