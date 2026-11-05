import { Skeleton } from "@/components/ui/skeleton";

export default function FacilitiesLoading() {
	return (
		<div className="flex flex-col gap-5 p-4 md:p-6">
			<div>
				<Skeleton className="mb-2 h-8 w-48" />
				<Skeleton className="h-4 w-72" />
			</div>
			<Skeleton className="h-10 w-56" />
			<Skeleton className="h-[640px] w-full rounded-xl" />
		</div>
	);
}
