"use client";

import React from "react";
import { ArrowUp, ArrowDown, X, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PositionSearchBox } from "@/features/allocation/components/position-search-box";
import type { Applicant, Position } from "@/features/allocation/types/applicants";
import type { UserSearchResult } from "@/features/cca/types/members";

interface PositionCardProps {
	position: Position;
	positionIndex: number;
	saving: boolean;
	hasChanges: boolean;
	onAddApplicant: (userData: UserSearchResult) => void;
	onRemoveApplicant: (userId: number) => void;
	onMoveApplicant: (applicantIndex: number, direction: number) => void;
	onSaveRankings: () => void;
}

export function PositionCard({
	position,
	saving,
	hasChanges,
	onAddApplicant,
	onRemoveApplicant,
	onMoveApplicant,
	onSaveRankings,
}: PositionCardProps) {
	return (
		<Card className="shadow-sm transition-all hover:shadow-md mb-6">
			<div className="flex items-start p-5 gap-4">
				<div className="text-2xl font-bold text-muted-foreground pr-5 min-w-[40px] text-center mt-1.5" />
				<div className="mr-6">
					<h3 className="text-lg font-bold text-foreground">{position.name}</h3>
					<p className="py-2 text-base text-muted-foreground">{position.cca_name}</p>
					<div className="inline-flex items-center justify-center mb-2 gap-2">
						<span className="text-xs px-2 py-1.5 gap-1.5 bg-primary/10 text-primary rounded-xs font-bold">
							{position.position_type === "maincomm"
								? "Main Committee"
								: position.position_type === "subcomm"
									? "Sub Committee"
									: position.position_type}
						</span>
						<span className="flex p-1 text-sm text-muted-foreground self-center">
							Available Capacity: {position.available_capacity}
						</span>
					</div>
				</div>
				<div className="flex-1 px-4">
					<PositionSearchBox onAddApplicant={onAddApplicant} />
					{position.applicants.length === 0 ? (
						<div className="text-red-500 mb-2.5 text-sm p-2">
							<p>
								No applicants added for this position. Use the search above to find and add
								applicants.
							</p>
						</div>
					) : (
						<>
							<div className="mb-2.5 text-medium font-light p-2">
								Applicants ({position.applicants.length})
								{position.applicants.length < position.available_capacity && (
									<span className="text-red-500 text-medium ml-1">
										Warning: Fewer applicants than available slots.
									</span>
								)}
							</div>
							{position.applicants.map((app: Applicant, appIdx: number) => (
								<div
									key={app.id || `applicant-${appIdx}`}
									className="flex items-center border-b border-gray-100 py-1.5 mb-5"
								>
									<div className="text-2xl p-5 font-bold text-muted-foreground mr-5 min-w-[40px] text-center">
										{appIdx + 1}
									</div>
									<div className="flex-1">
										<div className="font-medium text-foreground">{app.name}</div>
										<div className="text-sm text-muted-foreground">
											{app.email} | Room {app.room}
										</div>
									</div>
									<div className="flex flex-col gap-2 ml-4">
										<Button
											variant="outline"
											size="icon"
											className="h-8 w-8"
											onClick={() => onMoveApplicant(appIdx, -1)}
											disabled={appIdx === 0}
											title="Move up"
										>
											<ArrowUp className="h-4 w-4" />
										</Button>
										<Button
											variant="outline"
											size="icon"
											className="h-8 w-8"
											onClick={() => onMoveApplicant(appIdx, 1)}
											disabled={appIdx === position.applicants.length - 1}
											title="Move down"
										>
											<ArrowDown className="h-4 w-4" />
										</Button>
										<Button
											variant="outline"
											size="icon"
											className="h-8 w-8 hover:text-destructive"
											onClick={() => onRemoveApplicant(app.id)}
											title="Remove from consideration"
										>
											<X className="h-4 w-4 text-red-500" />
										</Button>
									</div>
								</div>
							))}
						</>
					)}
					<Button
						onClick={onSaveRankings}
						disabled={saving || !hasChanges}
						className="mt-6 font-semibold"
						variant={hasChanges ? "default" : "secondary"}
					>
						{saving ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Saving...
							</>
						) : (
							"Save Rankings"
						)}
					</Button>
				</div>
			</div>
		</Card>
	);
}
