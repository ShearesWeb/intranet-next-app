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
			<CardContent className="flex flex-col items-center justify-center py-16 text-center">
				<div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-4 animate-[fade-in-up_0.3s_ease-out_0.05s_both]">
					<Icon className="h-10 w-10 text-muted-foreground/60" />
				</div>
				<p className="text-lg font-semibold text-foreground mb-2 animate-[fade-in-up_0.3s_ease-out_0.1s_both]">
					{title}
				</p>
				{description && (
					<p className="text-sm text-muted-foreground animate-[fade-in-up_0.3s_ease-out_0.15s_both]">
						{description}
					</p>
				)}
				{action && (
					<div className="mt-4 animate-[fade-in-up_0.3s_ease-out_0.2s_both]">{action}</div>
				)}
			</CardContent>
		</Card>
	);
}
