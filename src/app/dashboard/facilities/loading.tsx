import { Skeleton } from "@/components/ui/skeleton";

export default function FacilitiesLoading() {
	return (
		<div className="space-y-6 p-4 md:p-6">
			<div>
				<Skeleton className="mb-2 h-8 w-48" />
				<Skeleton className="h-4 w-72" />
			</div>
			<Skeleton className="h-24 w-full rounded-xl" />
			<Skeleton className="h-72 w-full rounded-lg" />
		</div>
	);
}
