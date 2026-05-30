"use client";

import React from "react";
import { Loader2, Users, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { useApplicantRankings } from "@/hooks/use-applicant-rankings";
import { PositionCard } from "@/components/allocation/position-card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { CcaPositionGroup, Position } from "@/types/applicants";

export default function RankApplicants() {
	const { user } = useAuth();
	const {
		ccaGroups,
		positions,
		loading,
		isSaving,
		hasChanges,
		hasAnyChanges,
		mounted,
		handleAddApplicant,
		handleRemoveApplicant,
		handleReorderApplicants,
		handleSaveAll,
	} = useApplicantRankings(user?.email);

	const [expandedCcas, setExpandedCcas] = React.useState<Set<number>>(new Set());
	const [expandedPositions, setExpandedPositions] = React.useState<Set<number>>(new Set());
	const initializedRef = React.useRef(false);

	React.useEffect(() => {
		if (ccaGroups.length > 0 && !initializedRef.current) {
			initializedRef.current = true;
			setExpandedCcas(new Set(ccaGroups.map((g) => g.cca_id)));
			setExpandedPositions(new Set(positions.map((p) => p.id)));
		}
	}, [ccaGroups, positions]);

	const toggleCca = (ccaId: number) => {
		setExpandedCcas((prev) => {
			const next = new Set(prev);
			if (next.has(ccaId)) next.delete(ccaId);
			else next.add(ccaId);
			return next;
		});
	};

	const togglePosition = (posId: number) => {
		setExpandedPositions((prev) => {
			const next = new Set(prev);
			if (next.has(posId)) next.delete(posId);
			else next.add(posId);
			return next;
		});
	};

	const collapseAll = () => {
		setExpandedCcas(new Set());
		setExpandedPositions(new Set());
	};

	const expandAll = () => {
		setExpandedCcas(new Set(ccaGroups.map((g) => g.cca_id)));
		setExpandedPositions(new Set(positions.map((p) => p.id)));
	};

	if (!mounted || !user) return <LoadingSpinner message="Loading..." />;

	if (loading) {
		return <LoadingSpinner message="Loading CCA positions and applicants..." />;
	}

	const totalApplicants = positions.reduce((sum, p) => sum + p.applicants.length, 0);
	const dirtyCount = Object.values(hasChanges).filter(Boolean).length;

	const saveButton =
		positions.length > 0 ? (
			<Button onClick={handleSaveAll} disabled={isSaving || !hasAnyChanges}>
				{isSaving ? (
					<>
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						Saving...
					</>
				) : hasAnyChanges ? (
					`Save ${dirtyCount} position${dirtyCount > 1 ? "s" : ""}`
				) : (
					"All saved"
				)}
			</Button>
		) : undefined;

	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			<PageHeader
				title="Chair preferences"
				description="Rank applicants across all your CCA positions. Drag to reorder, then save."
				actions={saveButton}
			/>

			{positions.length === 0 ? (
				<EmptyState
					title="No CCA positions to manage"
					description="You don't manage any positions with available capacity. This could mean all positions are filled, or you don't have chair/reporting-chain access to any CCA."
				/>
			) : (
				<>
					{/* Summary bar */}
					<div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
						<span>
							{ccaGroups.length} CCA{ccaGroups.length > 1 ? "s" : ""} · {positions.length} position{positions.length > 1 ? "s" : ""} · {totalApplicants} applicant{totalApplicants !== 1 ? "s" : ""}
						</span>
						<div className="ml-auto flex gap-2">
							<Button variant="ghost" size="sm" onClick={expandAll}>
								Expand all
							</Button>
							<Button variant="ghost" size="sm" onClick={collapseAll}>
								Collapse all
							</Button>
						</div>
					</div>

					{hasAnyChanges && (
						<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
							<p className="text-sm font-medium text-amber-800 dark:text-amber-200">
								You have unsaved changes in {dirtyCount} position{dirtyCount > 1 ? "s" : ""}. Don&apos;t forget to save!
							</p>
						</div>
					)}

					{/* CCA groups */}
					<div className="flex flex-col gap-4">
						{ccaGroups.map((group: CcaPositionGroup) => (
							<CcaSection
								key={group.cca_id}
								group={group}
								isExpanded={expandedCcas.has(group.cca_id)}
								expandedPositions={expandedPositions}
								hasChanges={hasChanges}
								onToggleCca={() => toggleCca(group.cca_id)}
								onTogglePosition={togglePosition}
								onAddApplicant={handleAddApplicant}
								onRemoveApplicant={handleRemoveApplicant}
								onReorderApplicants={handleReorderApplicants}
							/>
						))}
					</div>
				</>
			)}

			{isSaving && <LoadingSpinner message="Saving preferences..." overlay />}
		</div>
	);
}

function CcaSection({
	group,
	isExpanded,
	expandedPositions,
	hasChanges,
	onToggleCca,
	onTogglePosition,
	onAddApplicant,
	onRemoveApplicant,
	onReorderApplicants,
}: {
	group: CcaPositionGroup;
	isExpanded: boolean;
	expandedPositions: Set<number>;
	hasChanges: Record<number, boolean>;
	onToggleCca: () => void;
	onTogglePosition: (id: number) => void;
	onAddApplicant: (positionId: number, userData: import("@/types/members").UserSearchResult) => void;
	onRemoveApplicant: (positionId: number, userId: number) => void;
	onReorderApplicants: (positionId: number, newApplicants: import("@/types/applicants").Applicant[]) => void;
}) {
	const totalApplicants = group.positions.reduce((sum, p) => sum + p.applicants.length, 0);
	const dirtyPositions = group.positions.filter((p) => hasChanges[p.id]);

	return (
		<Collapsible open={isExpanded} onOpenChange={onToggleCca}>
			<div className="rounded-lg border bg-card">
				<CollapsibleTrigger asChild>
					<button className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors">
						<ChevronDown
							className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "" : "-rotate-90"}`}
						/>
						<div className="flex flex-1 flex-wrap items-center gap-2">
							<h2 className="text-base font-semibold">{group.cca_name}</h2>
							<Badge variant="secondary" className="font-normal">
								{group.positions.length} position{group.positions.length > 1 ? "s" : ""}
							</Badge>
							<span className="flex items-center gap-1 text-xs text-muted-foreground">
								<Users className="h-3 w-3" />
								{totalApplicants}
							</span>
							{dirtyPositions.length > 0 && (
								<Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
									{dirtyPositions.length} unsaved
								</Badge>
							)}
						</div>
					</button>
				</CollapsibleTrigger>

				<CollapsibleContent>
					<div className="flex flex-col divide-y border-t">
						{group.positions.map((pos: Position) => (
							<CollapsiblePosition
								key={pos.id}
								position={pos}
								isExpanded={expandedPositions.has(pos.id)}
								hasChanges={hasChanges[pos.id] || false}
								onToggle={() => onTogglePosition(pos.id)}
								onAddApplicant={(userData) => onAddApplicant(pos.id, userData)}
								onRemoveApplicant={(userId) => onRemoveApplicant(pos.id, userId)}
								onReorderApplicants={(newApplicants) => onReorderApplicants(pos.id, newApplicants)}
							/>
						))}
					</div>
				</CollapsibleContent>
			</div>
		</Collapsible>
	);
}

function CollapsiblePosition({
	position,
	isExpanded,
	hasChanges,
	onToggle,
	onAddApplicant,
	onRemoveApplicant,
	onReorderApplicants,
}: {
	position: Position;
	isExpanded: boolean;
	hasChanges: boolean;
	onToggle: () => void;
	onAddApplicant: (userData: import("@/types/members").UserSearchResult) => void;
	onRemoveApplicant: (userId: number) => void;
	onReorderApplicants: (newApplicants: import("@/types/applicants").Applicant[]) => void;
}) {
	return (
		<Collapsible open={isExpanded} onOpenChange={onToggle}>
			<div className="px-4">
				<CollapsibleTrigger asChild>
					<button className="flex w-full items-center gap-3 py-3 text-left hover:bg-muted/30 -mx-2 px-2 rounded transition-colors">
						<ChevronDown
							className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "" : "-rotate-90"}`}
						/>
						<div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
							<span className="font-medium text-sm truncate">{position.name}</span>
							<Badge variant="outline" className="text-xs font-normal">
								{position.position_type}
							</Badge>
							<span className="text-xs text-muted-foreground">
								{position.available_capacity}/{position.capacity} available
							</span>
							{hasChanges && (
								<span className="h-2 w-2 rounded-full bg-amber-500" title="Unsaved changes" />
							)}
						</div>
					</button>
				</CollapsibleTrigger>

				<CollapsibleContent>
					<div className="pb-4 pt-1">
						<PositionCard
							position={position}
							hasChanges={hasChanges}
							onAddApplicant={onAddApplicant}
							onRemoveApplicant={onRemoveApplicant}
							onReorderApplicants={onReorderApplicants}
							compact
						/>
					</div>
				</CollapsibleContent>
			</div>
		</Collapsible>
	);
}
