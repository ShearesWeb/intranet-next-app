import { DashboardTableSkeleton } from "@/components/layout/dashboard-skeletons";

export default function Loading() {
	return <DashboardTableSkeleton rows={6} cols={4} />;
}
