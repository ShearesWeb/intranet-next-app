"use client";

import React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PositionTypeBadge } from "@/components/badges";
import { OrderingTable, type OrderingTableColumn } from "@/components/table/ordering-table";
import { AddApplicantDialog } from "@/components/allocation/add-applicant-dialog";
import type { Applicant, Position } from "@/types/applicants";
import type { UserSearchResult } from "@/types/members";

interface PositionCardProps {
	position: Position;
	hasChanges: boolean;
	onAddApplicant: (userData: UserSearchResult) => void;
	onRemoveApplicant: (userId: number) => void;
	onReorderApplicants: (newApplicants: Applicant[]) => void;
	compact?: boolean;
}

export function PositionCard({
	position,
	hasChanges,
	onAddApplicant,
	onRemoveApplicant,
	onReorderApplicants,
	compact = false,
}: PositionCardProps) {
	const columns = React.useMemo<OrderingTableColumn<Applicant>[]>(
		() => [
			{
				accessorKey: "name",
				header: "Applicant",
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
							className="h-8 w-8 text-muted-foreground hover:text-destructive"
							onClick={() => onRemoveApplicant(row.id)}
							title="Remove applicant"
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
				),
			},
		],
		[onRemoveApplicant],
	);

	if (compact) {
		return (
			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between gap-2">
					<div className="text-xs text-muted-foreground">
						{position.available_capacity}/{position.capacity} available
					</div>
					<AddApplicantDialog
						onAddApplicant={onAddApplicant}
						excludedIds={position.applicants.map((a) => a.id)}
					/>
				</div>
				<OrderingTable<Applicant>
					data={position.applicants}
					columns={columns}
					onReorder={onReorderApplicants}
					showRankColumn={true}
					emptyMessage={'No applicants yet. Click "Add applicant" to find candidates.'}
				/>
			</div>
		);
	}

	return (
		<section className="flex flex-col gap-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex flex-col gap-1">
					<div className="text-sm font-medium text-muted-foreground">{position.cca_name}</div>
					<div className="flex flex-wrap items-center gap-2">
						<h2 className="text-lg font-semibold text-foreground">{position.name}</h2>
						<PositionTypeBadge value={position.position_type} />
						{hasChanges && (
							<span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
								Unsaved
							</span>
						)}
					</div>
				</div>
				<div className="flex items-center gap-3">
					<div className="text-sm text-muted-foreground">
						{position.available_capacity}/{position.capacity} available
					</div>
					<AddApplicantDialog
						onAddApplicant={onAddApplicant}
						excludedIds={position.applicants.map((a) => a.id)}
					/>
				</div>
			</div>

			<OrderingTable<Applicant>
				data={position.applicants}
				columns={columns}
				onReorder={onReorderApplicants}
				showRankColumn={true}
				emptyMessage={'No applicants yet. Click "Add applicant" to find candidates.'}
			/>
		</section>
	);
}
