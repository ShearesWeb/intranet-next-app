import { DashboardCardsSkeleton } from "@/components/layout/dashboard-skeletons";

export default function Loading() {
	return <DashboardCardsSkeleton count={2} columns={2} />;
}
