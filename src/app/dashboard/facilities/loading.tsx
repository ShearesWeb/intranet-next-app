import { Skeleton } from "@/components/ui/skeleton";

export default function FacilitiesLoading() {
	return (
		<div className="space-y-6 p-4 md:p-6">
			<div>
				<Skeleton className="mb-2 h-8 w-48" />
				<Skeleton className="h-4 w-72" />
			</div>
			<Skeleton className="h-24 w-full rounded-xl" />
			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
				{Array.from({ length: 6 }).map((_, index) => (
					<div key={index} className="rounded-xl border p-3">
						<Skeleton className="aspect-[16/7] w-full rounded-lg" />
						<Skeleton className="mt-3 h-6 w-2/3" />
						<div className="mt-3 grid grid-cols-3 gap-2">
							<Skeleton className="h-10" />
							<Skeleton className="h-10" />
							<Skeleton className="h-10" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
