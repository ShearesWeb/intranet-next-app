import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/** Compact dashed empty placeholder for panels and tables. */
export function DashedEmpty({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground",
				className,
			)}
		>
			{children}
		</div>
	);
}

/** Centered spinner block shown while a table or panel loads. */
export function CenteredSpinner({ className }: { className?: string }) {
	return (
		<div className={cn("flex justify-center py-8", className)}>
			<Spinner className="h-6 w-6" />
		</div>
	);
}
