import { DashboardCardsSkeleton } from "@/components/layout/dashboard-skeletons";

export default function Loading() {
	return <DashboardCardsSkeleton count={3} columns={1} />;
}
