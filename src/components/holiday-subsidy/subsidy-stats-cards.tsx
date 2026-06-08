"use client";

import { CalendarDeclaration } from "@/types/declarations";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, CheckCircle2, Users, XCircle } from "lucide-react";

interface SubsidyStatsCardsProps {
	declarations: CalendarDeclaration[];
	/** Render shimmer placeholders for the counts while data is loading. */
	loading?: boolean;
}

export function SubsidyStatsCards({ declarations, loading = false }: SubsidyStatsCardsProps) {
	const pending = declarations.filter((d) => d.status === "pending").length;
	const needsAction = declarations.filter(
		(d) => d.status === "approved" && (d.member_count === 0 || d.pending_member_count > 0),
	).length;
	const complete = declarations.filter(
		(d) => d.status === "approved" && d.member_count > 0 && d.pending_member_count === 0,
	).length;
	const rejected = declarations.filter((d) => d.status === "rejected").length;

	const cards = [
		{
			label: "Pending Approval",
			value: pending,
			color: "#fbbf24",
			icon: Clock,
		},
		{
			label: "Member Declarations",
			value: needsAction,
			color: "#3b82f6",
			icon: Users,
		},
		{
			label: "Complete",
			value: complete,
			color: "#10b981",
			icon: CheckCircle2,
		},
		{
			label: "Rejected",
			value: rejected,
			color: "#f87171",
			icon: XCircle,
		},
	];

	return (
		<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
			{cards.map((card) => (
				<div key={card.label} className="rounded-lg border bg-card p-4">
					<div className="flex items-center gap-2">
						<card.icon className="h-4 w-4" style={{ color: card.color }} />
						<span className="text-xs font-medium text-muted-foreground">{card.label}</span>
					</div>
					{loading ? (
						<Skeleton className="mt-2 h-8 w-10" />
					) : (
						<div className="mt-2 text-2xl font-bold tabular-nums" style={{ color: card.color }}>
							{card.value}
						</div>
					)}
				</div>
			))}
		</div>
	);
}
