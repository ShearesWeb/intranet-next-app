"use client";

import { useState } from "react";
import { CalendarDeclaration, SUBSIDY_STATUS_CONFIG } from "@/types/declarations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Users } from "lucide-react";

type DeclAction = (decl: CalendarDeclaration) => void | Promise<void>;

interface SubsidyDayPanelProps {
	date: string;
	declarations: CalendarDeclaration[];
	isChair: boolean;
	isJcrc: boolean;
	onDeclare?: () => void;
	onEdit?: (decl: CalendarDeclaration) => void;
	onDelete?: DeclAction;
	onApprove?: DeclAction;
	onReject?: DeclAction;
	onAssignMembers?: (decl: CalendarDeclaration) => void;
}

function formatDisplayDate(dateStr: string): string {
	const d = new Date(dateStr + "T00:00:00");
	return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export function SubsidyDayPanel({
	date,
	declarations,
	isChair,
	isJcrc,
	onDeclare,
	onEdit,
	onDelete,
	onApprove,
	onReject,
	onAssignMembers,
}: SubsidyDayPanelProps) {
	// Track the single in-flight row action as `${declId}:${action}` so only the
	// actioned button spins while every other action button disables.
	const [loadingKey, setLoadingKey] = useState<string | null>(null);

	const sorted = [...declarations].sort((a, b) => {
		const ccaCmp = a.cca_name.localeCompare(b.cca_name);
		if (ccaCmp !== 0) return ccaCmp;
		return a.position_name.localeCompare(b.position_name);
	});

	function runAction(decl: CalendarDeclaration, action: string, handler?: DeclAction) {
		if (!handler) return;
		const key = `${decl.id}:${action}`;
		setLoadingKey(key);
		Promise.resolve(handler(decl)).finally(() => {
			setLoadingKey((current) => (current === key ? null : current));
		});
	}

	return (
		<div className="flex-1 min-w-0">
			<div className="mb-3 flex items-center justify-between">
				<h3 className="text-lg font-semibold">{formatDisplayDate(date)}</h3>
				{isChair && onDeclare && (
					<Button size="sm" onClick={onDeclare}>
						Declare Subsidy
					</Button>
				)}
			</div>

			{sorted.length === 0 ? (
				<div className="rounded-lg border border-dashed p-8 text-center">
					<p className="text-sm text-muted-foreground">
						{isChair
							? 'No declarations on this day. Click "Declare Subsidy" to add one.'
							: "No declarations on this day."}
					</p>
				</div>
			) : (
				<div className="overflow-hidden rounded-lg border">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
								<th className="px-3 py-2">CCA</th>
								<th className="px-3 py-2">Position</th>
								<th className="px-3 py-2">Hours</th>
								<th className="px-3 py-2">Status</th>
								<th className="px-3 py-2 w-[1%]" />
							</tr>
						</thead>
						<tbody>
							{sorted.map((decl) => (
								<DeclRow
									key={decl.id}
									decl={decl}
									isChair={isChair}
									isJcrc={isJcrc}
									loadingKey={loadingKey}
									onEdit={onEdit}
									onRunAction={runAction}
									onDelete={onDelete}
									onApprove={onApprove}
									onReject={onReject}
									onAssignMembers={onAssignMembers}
								/>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}

function DeclRow({
	decl,
	isChair,
	isJcrc,
	loadingKey,
	onEdit,
	onRunAction,
	onDelete,
	onApprove,
	onReject,
	onAssignMembers,
}: {
	decl: CalendarDeclaration;
	isChair: boolean;
	isJcrc: boolean;
	loadingKey: string | null;
	onEdit?: (decl: CalendarDeclaration) => void;
	onRunAction: (decl: CalendarDeclaration, action: string, handler?: DeclAction) => void;
	onDelete?: DeclAction;
	onApprove?: DeclAction;
	onReject?: DeclAction;
	onAssignMembers?: (decl: CalendarDeclaration) => void;
}) {
	const statusConfig = SUBSIDY_STATUS_CONFIG[decl.status];
	const isPending = decl.status === "pending";
	const isApproved = decl.status === "approved";
	const noMembers = isApproved && decl.member_count === 0;
	const allApproved = isApproved && decl.member_count > 0 && decl.pending_member_count === 0;
	const remaining = decl.pending_member_count;

	// Any in-flight action on this row disables its sibling buttons.
	const busy = loadingKey !== null && loadingKey.startsWith(`${decl.id}:`);
	const isLoadingAction = (action: string) => loadingKey === `${decl.id}:${action}`;

	return (
		<tr className="border-b last:border-0 hover:bg-accent/50 transition-colors">
			<td className="px-3 py-2.5">
				<div className="font-medium">{decl.cca_name}</div>
			</td>
			<td className="px-3 py-2.5">
				<div>{decl.position_name}</div>
				<div className="text-xs text-muted-foreground">{decl.position_type}</div>
			</td>
			<td className="px-3 py-2.5 tabular-nums">{decl.hours}h</td>
			<td className="px-3 py-2.5">
				<div className="flex items-center gap-2">
					<span
						className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-medium")}
						style={{
							backgroundColor: `${statusConfig.color}20`,
							color: statusConfig.color,
						}}
					>
						{statusConfig.label}
					</span>
					{isApproved && (
						<span
							className={cn(
								"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
								allApproved ? "bg-[#10b981]/15 text-[#10b981]" : "bg-[#3b82f6]/15 text-[#3b82f6]",
							)}
						>
							<Users className="h-2.5 w-2.5" />
							{noMembers
								? "No member declarations"
								: allApproved
									? "Complete"
									: `${remaining} remaining`}
						</span>
					)}
				</div>
				{decl.justification && (
					<div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
						{decl.justification}
					</div>
				)}
				{decl.rejection_reason && (
					<div className="mt-0.5 text-xs text-destructive line-clamp-1">
						{decl.rejection_reason}
					</div>
				)}
			</td>
			<td className="px-3 py-2.5 whitespace-nowrap">
				<div className="flex gap-1">
					{isChair && isApproved && onAssignMembers && (
						<Button
							size="sm"
							variant="outline"
							disabled={busy}
							className={cn(
								"h-7 text-xs",
								noMembers ? "text-[#3b82f6] border-[#3b82f6]/30 hover:bg-[#3b82f6]/10" : "",
							)}
							onClick={() => onAssignMembers(decl)}
						>
							<Users className="h-3 w-3 mr-1" />
							Members
						</Button>
					)}
					{isJcrc && isApproved && decl.member_count > 0 && onAssignMembers && (
						<Button
							size="sm"
							variant="outline"
							disabled={busy}
							className="h-7 text-xs"
							onClick={() => onAssignMembers(decl)}
						>
							<Users className="h-3 w-3 mr-1" />
							Review Members
						</Button>
					)}
					{isJcrc && isPending && onApprove && (
						<Button
							size="sm"
							variant="outline"
							disabled={busy}
							isLoading={isLoadingAction("approve")}
							loadingText="Approving…"
							className="h-7 text-xs text-[#10b981] border-[#10b981]/30 hover:bg-[#10b981]/10"
							onClick={() => onRunAction(decl, "approve", onApprove)}
						>
							Approve
						</Button>
					)}
					{isJcrc && (isPending || isApproved) && onReject && (
						<Button
							size="sm"
							variant="outline"
							disabled={busy}
							isLoading={isLoadingAction("reject")}
							loadingText={isApproved ? "Revoking…" : "Rejecting…"}
							className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
							onClick={() => onRunAction(decl, "reject", onReject)}
						>
							{isApproved ? "Revoke" : "Reject"}
						</Button>
					)}
					{isChair && isPending && onEdit && (
						<Button
							size="sm"
							variant="outline"
							disabled={busy}
							className="h-7 text-xs"
							onClick={() => onEdit(decl)}
						>
							Edit
						</Button>
					)}
					{isChair && isPending && onDelete && (
						<Button
							size="sm"
							variant="outline"
							disabled={busy}
							isLoading={isLoadingAction("delete")}
							loadingText="Deleting…"
							className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
							onClick={() => onRunAction(decl, "delete", onDelete)}
						>
							Delete
						</Button>
					)}
				</div>
			</td>
		</tr>
	);
}
