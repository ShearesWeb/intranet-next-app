"use client";

import { PositionTypeBadge } from "@/components/badges/position-type-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { CCAMember, PositionGroup, ScoreField } from "@/features/ranking/types/ranking";
import { RESIDENT_METRICS, SCORE_OPTIONS } from "@/features/ranking/types/ranking";
import {
	formatCommitmentPeriod,
	formatCutStatus,
	isResidentPositionType,
} from "@/features/ranking/utils/ranking-editor";

type PositionRankingCardProps = {
	group: PositionGroup;
	ccaType: string;
	onFieldChange: <K extends keyof CCAMember>(rowKey: string, field: K, value: CCAMember[K]) => void;
};

export function PositionRankingCard({ group, ccaType, onFieldChange }: PositionRankingCardProps) {
	const isResidentGroup = isResidentPositionType(group.position_type);
	const renderScoreSelect = (member: CCAMember, field: ScoreField) => (
		<select
			value={member[field] || 0}
			onChange={(event) => onFieldChange(member.row_key, field, parseInt(event.target.value, 10))}
			className="w-20 p-2 border rounded-md bg-background text-sm"
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
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-base">
					<div className="flex items-center gap-2">
						<span className="text-xl">{group.position}</span>
						<span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
							<PositionTypeBadge
								value={(group.position_type || "unknown").replace(/_/g, " ").toLowerCase()}
								position_type={group.position_type}
								className="h-5 px-2 py-0 text-[11px] lowercase"
							/>
						</span>
					</div>
				</CardTitle>
				<CardDescription>
					{group.members.length} member{group.members.length !== 1 ? "s" : ""}
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="rounded-md border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-[88px]">Rank</TableHead>
								<TableHead>Name</TableHead>
								{!isResidentGroup && (ccaType === "sports" ? <TableHead>Status</TableHead> : <TableHead>Commitment</TableHead>)}
								{isResidentGroup ? (
									RESIDENT_METRICS.map((metric) => <TableHead key={metric.field}>{metric.label} (1-10)</TableHead>)
								) : (
									<TableHead>{ccaType === "sports" ? "Captain's Appraisal (1-10)" : "Attendance and Attitude (1-10)"}</TableHead>
								)}
								{!isResidentGroup && ccaType !== "sports" && <TableHead>Performance (1-10)</TableHead>}
								<TableHead>Remarks</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{group.members.map((member) => (
								<TableRow key={member.row_key}>
									<TableCell>
										<div className="ml-2 flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold text-lg">
											{member.ranking}
										</div>
									</TableCell>
									<TableCell className="font-medium">{member.name}</TableCell>
									{!isResidentGroup && (
										ccaType === "sports" ? <TableCell className="text-sm">{formatCutStatus(member.cut_status)}</TableCell> : <TableCell className="text-sm">{formatCommitmentPeriod(member.commitment_period)}</TableCell>
									)}
									{isResidentGroup ? (
										RESIDENT_METRICS.map((metric) => <TableCell key={metric.field}>{renderScoreSelect(member, metric.field)}</TableCell>)
									) : (
										<TableCell>{renderScoreSelect(member, "attendance")}</TableCell>
									)}
									{!isResidentGroup && ccaType !== "sports" && <TableCell>{renderScoreSelect(member, "performance")}</TableCell>}
									<TableCell className="min-w-[220px]">
										<Textarea
											value={member.remarks || ""}
											onChange={(event) => onFieldChange(member.row_key, "remarks", event.target.value)}
											placeholder="Enter remarks"
											className="min-h-[60px] text-sm"
										/>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			</CardContent>
		</Card>
	);
}
