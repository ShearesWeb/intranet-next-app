"use client";

import React from "react";
import { ListPlus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PositionTypeBadge } from "@/components/badges";
import { OrderingTable, type OrderingTableColumn } from "@/components/table/ordering-table";
import { AddApplicantDialog } from "@/components/allocation/add-applicant-dialog";
import { CoverageMeter } from "@/components/allocation/coverage-indicator";
import type { Applicant, Position } from "@/types/applicants";
import type { UserSearchResult } from "@/types/members";

interface PositionCardProps {
	position: Position;
	hasChanges: boolean;
	onAddApplicant: (userData: UserSearchResult) => void;
	onRankApplicant: (userId: number) => void;
	onRemoveApplicant: (userId: number) => void;
	onReorderApplicants: (newApplicants: Applicant[]) => void;
}

export function PositionCard({
	position,
	hasChanges,
	onAddApplicant,
	onRankApplicant,
	onRemoveApplicant,
	onReorderApplicants,
}: PositionCardProps) {
	const columns = React.useMemo<OrderingTableColumn<Applicant>[]>(
		() => [
			{
				accessorKey: "name",
				header: "Candidate",
				cell: (_value, row) => (
					<div>
						<div className="font-medium">{row.name}</div>
						<div className="text-sm text-muted-foreground">
							{row.email} &middot; Room {row.room}
						</div>
					</div>
				),
			},
			{
				accessorKey: "id",
				header: "",
				cell: (_value, row) => (
					<div className="flex justify-end">
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8 text-destructive/60 hover:bg-destructive/10 hover:text-destructive"
							onClick={() => onRemoveApplicant(row.id)}
							title={`Remove ${row.name}`}
							aria-label={`Remove ${row.name}`}
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
				),
			},
		],
		[onRemoveApplicant],
	);

	return (
		<section className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex flex-wrap items-center gap-2.5">
					<h2 className="text-lg font-semibold text-foreground">{position.name}</h2>
					<PositionTypeBadge value={position.position_type} />
					{hasChanges && (
						<Badge
							variant="outline"
							className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
						>
							Unsaved
						</Badge>
					)}
				</div>
				<div className="flex items-center gap-3">
					<span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground">
						<Users className="h-3.5 w-3.5" />
						{position.available_capacity}/{position.capacity} open
					</span>
					<AddApplicantDialog
						onAddApplicant={onAddApplicant}
						excludedIds={[...position.applicants, ...position.unranked_applicants].map((a) => a.id)}
					/>
				</div>
			</div>

			<CoverageMeter
				candidateCount={position.applicants.length}
				openSlots={position.available_capacity}
				className="max-w-xl"
			/>

			<OrderingTable<Applicant>
				data={position.applicants}
				columns={columns}
				onReorder={onReorderApplicants}
				showRankColumn={true}
				showMoveControls={true}
				searchable={position.applicants.length > 8}
				searchPlaceholder="Search candidates by name, email or room..."
				emptyMessage={'No candidates ranked yet. Click "Add candidate" to find people to rank.'}
			/>

			{position.unranked_applicants.length > 0 && (
				<div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
					<p className="text-sm font-medium text-muted-foreground">
						Applied, not in your ranking ({position.unranked_applicants.length})
					</p>
					<ul className="flex flex-col divide-y divide-border/60">
						{position.unranked_applicants.map((applicant) => (
							<li key={applicant.id} className="flex items-center justify-between gap-3 py-2">
								<div className="min-w-0">
									<div className="truncate font-medium">{applicant.name}</div>
									<div className="truncate text-sm text-muted-foreground">
										{applicant.email} &middot; Room {applicant.room}
									</div>
								</div>
								<Button
									variant="outline"
									size="sm"
									className="gap-1.5"
									onClick={() => onRankApplicant(applicant.id)}
								>
									<ListPlus className="h-4 w-4" />
									Add to ranking
								</Button>
							</li>
						))}
					</ul>
				</div>
			)}
		</section>
	);
}
