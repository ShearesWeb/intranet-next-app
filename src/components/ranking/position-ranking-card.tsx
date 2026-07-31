"use client";

import { PositionTypeBadge } from "@/components/badges";
import { Users } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { CCAMember, PositionGroup, ScoreField } from "@/types/ranking";
import { RESIDENT_METRICS, SCORE_OPTIONS } from "@/lib/ranking/constants";
import { formatCommitmentPeriod, isResidentPositionType } from "@/lib/ranking/ranking-editor";
import { formatCutStatus } from "@/lib/cca/cut-status";

type PositionRankingCardProps = {
	group: PositionGroup;
	ccaType: string;
	onFieldChange: <K extends keyof CCAMember>(rowKey: string, field: K, value: CCAMember[K]) => void;
};

export function PositionRankingCard({ group, ccaType, onFieldChange }: PositionRankingCardProps) {
	const isResidentGroup = isResidentPositionType(group.position_type);
	const renderScoreSelect = (member: CCAMember, field: ScoreField) => (
		<select
			key={`${member.row_key}-${field}-${member[field] || 0}`}
			value={member[field] || 0}
			onChange={(event) => onFieldChange(member.row_key, field, parseInt(event.target.value, 10))}
			className="h-9 w-20 px-3 border rounded-md bg-transparent text-sm cursor-pointer transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/60 animate-[fade-in-scale_200ms_ease-out]"
		>
			<option value={0}>-</option>
			{SCORE_OPTIONS.map((score) => (
				<option key={score} value={score}>
					{score}
				</option>
			))}
		</select>
	);

	return (
		<section className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex flex-wrap items-center gap-2.5">
					<h2 className="text-lg font-semibold text-foreground">{group.position}</h2>
					<PositionTypeBadge
						value={(group.position_type || "unknown").replace(/_/g, " ").toLowerCase()}
						positionType={group.position_type}
						className="h-5 px-2 py-0 text-[11px] lowercase"
					/>
				</div>
				<span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground">
					<Users className="h-3.5 w-3.5" />
					{group.members.length} member{group.members.length !== 1 ? "s" : ""}
				</span>
			</div>

			<div className="rounded-lg border overflow-x-auto shadow-sm">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-[88px]">Rank</TableHead>
							<TableHead>Name</TableHead>
							{!isResidentGroup &&
								(ccaType === "sports" ? (
									<TableHead>Status</TableHead>
								) : (
									<TableHead>Commitment</TableHead>
								))}
							{isResidentGroup ? (
								RESIDENT_METRICS.map((metric) => (
									<TableHead key={metric.field}>{metric.label} (1-10)</TableHead>
								))
							) : (
								<TableHead>
									{ccaType === "sports"
										? "Captain's Appraisal (1-10)"
										: "Attendance and Attitude (1-10)"}
								</TableHead>
							)}
							{!isResidentGroup && ccaType !== "sports" && (
								<TableHead>Performance (1-10)</TableHead>
							)}
							<TableHead>Remarks</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{group.members.map((member) => (
							<TableRow key={member.row_key}>
								<TableCell>
									<div
										key={member.ranking}
										className="ml-2 flex items-center justify-center size-9 rounded-full bg-gradient-to-br from-primary to-orange-600 text-primary-foreground font-bold text-sm shadow-sm animate-[fade-in-scale_200ms_ease-out]"
									>
										{member.ranking}
									</div>
								</TableCell>
								<TableCell className="font-medium">{member.name}</TableCell>
								{!isResidentGroup &&
									(ccaType === "sports" ? (
										<TableCell className="text-sm">{formatCutStatus(member.cut_status)}</TableCell>
									) : (
										<TableCell className="text-sm">
											{formatCommitmentPeriod(member.commitment_period)}
										</TableCell>
									))}
								{isResidentGroup ? (
									RESIDENT_METRICS.map((metric) => (
										<TableCell key={metric.field}>
											{renderScoreSelect(member, metric.field)}
										</TableCell>
									))
								) : (
									<TableCell>{renderScoreSelect(member, "attendance")}</TableCell>
								)}
								{!isResidentGroup && ccaType !== "sports" && (
									<TableCell>{renderScoreSelect(member, "performance")}</TableCell>
								)}
								<TableCell className="min-w-[220px]">
									<Textarea
										value={member.remarks || ""}
										onChange={(event) =>
											onFieldChange(member.row_key, "remarks", event.target.value)
										}
										placeholder="Enter remarks"
										className="min-h-[60px] text-sm"
									/>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</section>
	);
}
