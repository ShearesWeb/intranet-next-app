import { Inbox, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
	icon?: LucideIcon;
	title: string;
	description?: string;
	action?: React.ReactNode;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }: EmptyStateProps) {
	return (
		<Card className="border-dashed bg-muted/40">
			<CardContent className="flex flex-col items-center justify-center py-16 text-center animate-[fade-in-up_0.3s_ease-out_both]">
				<div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-4">
					<Icon className="h-10 w-10 text-muted-foreground/60" />
				</div>
				<p className="text-lg font-semibold text-foreground mb-2">{title}</p>
				{description && <p className="text-sm text-muted-foreground">{description}</p>}
				{action && <div className="mt-4">{action}</div>}
			</CardContent>
		</Card>
	);
}
