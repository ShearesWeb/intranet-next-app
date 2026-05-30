"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/table/data-table";
import { PositionTypeBadge } from "@/components/badges";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Check, X, Info, Save } from "lucide-react";
import type { MemberApprovalRow } from "@/lib/holiday-subsidy/member-approval-service";
import { SUBSIDY_STATUS_CONFIG, type SubsidyStatus } from "@/types/declarations";

interface SubsidyMemberApprovalTableProps {
	ccaId: number;
	ccaName: string;
	day: string;
	onSaved: () => void;
}

export function SubsidyMemberApprovalTable({
	ccaId,
	ccaName,
	day,
	onSaved,
}: SubsidyMemberApprovalTableProps) {
	const [members, setMembers] = useState<MemberApprovalRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [selected, setSelected] = useState<Set<number>>(new Set());
	const [pendingStatus, setPendingStatus] = useState<Map<number, "approved" | "rejected">>(
		new Map(),
	);

	const fetchMembers = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch(
				`/api/holiday-subsidy/approvals/members/${ccaId}?day=${day}`,
			);
			const json = await res.json();
			if (res.ok) {
				setMembers(json.data?.members ?? []);
			}
		} catch {
			toast.error("Failed to load member submissions");
		} finally {
			setLoading(false);
		}
	}, [ccaId, day]);

	useEffect(() => {
		fetchMembers();
		setSelected(new Set());
		setPendingStatus(new Map());
	}, [fetchMembers]);

	function toggleSelected(id: number) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	function stageStatus(status: "approved" | "rejected") {
		if (selected.size === 0) {
			toast.error(`Select at least one member to ${status === "approved" ? "approve" : "reject"}.`);
			return;
		}
		setPendingStatus((prev) => {
			const next = new Map(prev);
			members.forEach((row) => {
				if (!selected.has(row.id)) return;
				if (row.status === status) {
					next.delete(row.id);
				} else {
					next.set(row.id, status);
				}
			});
			return next;
		});
		setSelected(new Set());
	}

	async function handleSave() {
		if (pendingStatus.size === 0) {
			toast.error("No staged changes to save.");
			return;
		}

		setSaving(true);
		try {
			const updates = members
				.filter((row) => pendingStatus.has(row.id))
				.map((row) => ({
					userSubsidyId: row.user_subsidy_id,
					status: pendingStatus.get(row.id)!,
				}));

			const res = await fetch(`/api/holiday-subsidy/approvals/members/${ccaId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ updates }),
			});

			if (!res.ok) {
				const json = await res.json();
				toast.error(json.error ?? "Failed to save");
				return;
			}

			setMembers((prev) =>
				prev.map((row) => {
					const next = pendingStatus.get(row.id);
					return next ? { ...row, status: next } : row;
				}),
			);
			toast.success(`Saved ${updates.length} change(s)`);
			setPendingStatus(new Map());
			onSaved();
		} catch {
			toast.error("Network error");
		} finally {
			setSaving(false);
		}
	}

	const columns: ColumnDef<MemberApprovalRow>[] = useMemo(
		() => [
			{
				accessorKey: "name",
				header: () => <div className="font-semibold">Member</div>,
				cell: ({ row }) => (
					<div className="flex flex-col min-w-[140px]">
						<span className="font-semibold text-sm leading-tight">
							{row.original.name}
						</span>
						<span className="text-xs text-muted-foreground mt-0.5">
							{row.original.email}
						</span>
					</div>
				),
			},
			{
				accessorKey: "role",
				header: () => <div className="font-semibold">Role</div>,
				cell: ({ row }) => (
					<div className="min-w-[80px]">
						<PositionTypeBadge
							value={String(row.getValue("role"))}
							positionType={String(row.original.type)}
							className="text-xs"
						/>
					</div>
				),
			},
			{
				accessorKey: "hours",
				header: () => <div className="font-semibold">Hours</div>,
				cell: ({ row }) => (
					<div className="flex items-center gap-1 min-w-[60px]">
						<span className="font-semibold text-sm">{row.original.hours}</span>
						<span className="text-xs text-muted-foreground">hrs</span>
					</div>
				),
			},
			{
				accessorKey: "comments",
				header: () => <div className="font-semibold">Comments</div>,
				cell: ({ row }) => (
					<div className="min-w-[150px] max-w-[250px]">
						<p className="text-xs line-clamp-2">{row.original.comments || "—"}</p>
					</div>
				),
			},
			{
				accessorKey: "status",
				header: () => <div className="font-semibold">Status</div>,
				cell: ({ row }) => {
					const st = row.original.status;
					const staged = pendingStatus.get(row.original.id);
					const cfg = SUBSIDY_STATUS_CONFIG[st];
					return (
						<div className="flex flex-col gap-1 min-w-[110px]">
							<span
								className="inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize w-fit"
								style={{
									backgroundColor: `${cfg.color}20`,
									color: cfg.color,
								}}
							>
								{cfg.label}
							</span>
							{staged && (
								<div className="flex items-center gap-1 text-[11px] font-medium text-amber-700">
									<span>{"→"}</span>
									<StatusBadge status={staged} />
								</div>
							)}
						</div>
					);
				},
			},
		],
		[pendingStatus],
	);

	if (loading) {
		return (
			<div className="flex justify-center py-8">
				<Spinner className="h-6 w-6" />
			</div>
		);
	}

	if (members.length === 0) {
		return (
			<div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
				No member submissions for this declaration yet.
			</div>
		);
	}

	return (
		<section className="flex flex-col gap-4">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 className="text-lg font-semibold">
						Member Approvals — {ccaName}
					</h2>
					<div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
						<Info className="h-4 w-4 flex-shrink-0" />
						<span>
							{selected.size > 0 ? (
								<span className="font-medium text-foreground">
									{selected.size} member{selected.size === 1 ? "" : "s"} selected
								</span>
							) : pendingStatus.size > 0 ? (
								<span className="font-medium text-amber-600">
									{pendingStatus.size} staged change{pendingStatus.size === 1 ? "" : "s"} — click Save to apply
								</span>
							) : (
								"Select members, then stage an approve or reject decision."
							)}
						</span>
					</div>
				</div>
				<div className="flex gap-2">
					<Button
						onClick={() => stageStatus("rejected")}
						disabled={saving || selected.size === 0}
						variant="destructive"
						size="sm"
						className="gap-2"
					>
						<X className="h-4 w-4" />
						Reject selected
					</Button>
					<Button
						onClick={() => stageStatus("approved")}
						disabled={saving || selected.size === 0}
						size="sm"
						variant="outline"
						className="gap-2"
					>
						<Check className="h-4 w-4" />
						Approve selected
					</Button>
					<Button
						onClick={handleSave}
						disabled={saving || pendingStatus.size === 0}
						size="sm"
						className="gap-2"
					>
						<Save className="h-4 w-4" />
						{saving ? "Saving..." : "Save"}
					</Button>
				</div>
			</div>

			<DataTable<MemberApprovalRow, number>
				data={members}
				columns={columns}
				selectable
				selectedIds={selected}
				onSelectionChange={toggleSelected}
				idField="id"
				searchColumn="name"
				searchPlaceholder="Search members by name..."
				pageSize={20}
				emptyMessage="No member submissions found."
			/>
		</section>
	);
}

function StatusBadge({ status }: { status: SubsidyStatus }) {
	const cfg = SUBSIDY_STATUS_CONFIG[status];
	return (
		<span
			className="inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize"
			style={{
				backgroundColor: `${cfg.color}20`,
				color: cfg.color,
			}}
		>
			{cfg.label}
		</span>
	);
}
