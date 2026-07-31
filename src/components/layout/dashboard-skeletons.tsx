import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Grid of skeleton cards. Sized to match dashboard landing pages
 * that render a grid of navigation / summary cards.
 */
export function DashboardCardsSkeleton({
	count = 4,
	columns = 2,
	className,
}: {
	count?: number;
	columns?: 1 | 2 | 3;
	className?: string;
}) {
	const gridCols =
		columns === 3 ? "md:grid-cols-3" : columns === 2 ? "md:grid-cols-2" : "grid-cols-1";

	return (
		<div className={cn("flex flex-col gap-4 p-4 md:p-6", className)}>
			<Skeleton className="h-8 w-64" />
			<Skeleton className="h-4 w-full max-w-2xl" />
			<div className={cn("grid gap-4 pt-2", gridCols)}>
				{Array.from({ length: count }).map((_, idx) => (
					<Card key={idx} className="border-none shadow-sm">
						<CardHeader>
							<Skeleton className="h-6 w-1/2" />
						</CardHeader>
						<CardContent className="flex flex-col gap-3">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-3/4" />
							<Skeleton className="h-10 w-32" />
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}

/**
 * Table-shaped skeleton with a header row plus body rows. Matches the
 * shadcn SimpleTable layout used across CCA list and approvals pages.
 */
export function DashboardTableSkeleton({
	rows = 6,
	cols = 4,
	className,
}: {
	rows?: number;
	cols?: number;
	className?: string;
}) {
	return (
		<div className={cn("flex flex-col gap-4 p-4 md:p-6", className)}>
			<Skeleton className="h-8 w-64" />
			<div className="flex items-center gap-2">
				<Skeleton className="h-9 w-64" />
				<div className="ml-auto flex gap-2">
					<Skeleton className="h-9 w-24" />
				</div>
			</div>
			<div className="rounded-md border">
				<div
					className="grid gap-4 border-b bg-muted/30 p-3"
					style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
				>
					{Array.from({ length: cols }).map((_, idx) => (
						<Skeleton key={idx} className="h-4 w-3/4" />
					))}
				</div>
				{Array.from({ length: rows }).map((_, rowIdx) => (
					<div
						key={rowIdx}
						className="grid gap-4 border-b p-3 last:border-b-0"
						style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
					>
						{Array.from({ length: cols }).map((_, colIdx) => (
							<Skeleton key={colIdx} className="h-5 w-full" />
						))}
					</div>
				))}
			</div>
		</div>
	);
}

/**
 * Form-shaped skeleton with labels + inputs and a submit button.
 * Suitable for ranking editors, declaration forms, and weekly commitment pages.
 */
export function DashboardFormSkeleton({
	fields = 5,
	className,
}: {
	fields?: number;
	className?: string;
}) {
	return (
		<div className={cn("flex flex-col gap-4 p-4 md:p-6", className)}>
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<Skeleton className="h-8 w-72" />
				<div className="flex gap-2">
					<Skeleton className="h-10 w-32" />
					<Skeleton className="h-10 w-32" />
				</div>
			</div>
			<Card className="border-none shadow-sm">
				<CardContent className="flex flex-col gap-4 p-6">
					{Array.from({ length: fields }).map((_, idx) => (
						<div key={idx} className="flex flex-col gap-2">
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-10 w-full" />
						</div>
					))}
				</CardContent>
			</Card>
		</div>
	);
}
