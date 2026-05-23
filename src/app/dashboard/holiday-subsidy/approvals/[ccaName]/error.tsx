"use client";

import { DashboardError } from "@/components/layout/dashboard-error";

export default function Error({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return <DashboardError error={error} reset={reset} segmentLabel="CCA Subsidy Approvals" />;
}
