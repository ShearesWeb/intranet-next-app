import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
	title: string;
	description?: string;
	actions?: React.ReactNode;
	backHref?: string;
	backLabel?: string;
}

export function PageHeader({ title, description, actions, backHref, backLabel }: PageHeaderProps) {
	return (
		<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-[fade-in-up_0.3s_ease-out_both]">
			<div className="flex flex-col gap-2">
				<h1 className="text-2xl font-semibold">{title}</h1>
				{description && (
					<p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
				)}
			</div>
			{(actions || backHref) && (
				<div className="flex flex-wrap items-center gap-2">
					{actions}
					{backHref && (
						<Button asChild variant="outline" size="sm" className="group gap-2">
							<Link href={backHref}>
								<ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
								{backLabel || "Back"}
							</Link>
						</Button>
					)}
				</div>
			)}
		</div>
	);
}
