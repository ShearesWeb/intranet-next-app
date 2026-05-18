import { DashboardTableSkeleton } from "@/components/layout/dashboard-skeletons";

export default function Loading() {
	return <DashboardTableSkeleton rows={8} cols={5} />;
}
