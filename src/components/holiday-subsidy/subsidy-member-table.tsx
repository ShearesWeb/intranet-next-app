"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/table/data-table";
import { PositionTypeBadge } from "@/components/badges";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Save, Info } from "lucide-react";
import type { MemberAssignment } from "@/types/declarations";
import { SUBSIDY_STATUS_CONFIG, type SubsidyStatus } from "@/types/declarations";

interface SubsidyMemberTableProps {
	ccaId: number;
	ccaName: string;
	day: string;
	onSaved: () => void;
}

export function SubsidyMemberTable({ ccaId, ccaName, day, onSaved }: SubsidyMemberTableProps) {
	const [members, setMembers] = useState<MemberAssignment[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [selected, setSelected] = useState<Set<number>>(new Set());

	const fetchMembers = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch(`/api/holiday-subsidy/members/${ccaId}?day=${day}`);
			const json = await res.json();
			if (res.ok) {
				const fetched: MemberAssignment[] = json.data?.members ?? [];
				setMembers(fetched);
				setSelected(new Set(fetched.filter((m) => m.submitted).map((m) => m.user_id)));
			}
		} catch {
			toast.error("Failed to load members");
		} finally {
			setLoading(false);
		}
	}, [ccaId, day]);

	useEffect(() => {
		fetchMembers();
	}, [fetchMembers]);

	function handleChange(
		userId: number,
		key: keyof MemberAssignment,
		value: string | number | null,
	) {
		setMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, [key]: value } : m)));
	}

	function toggleSelected(userId: number) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(userId)) next.delete(userId);
			else next.add(userId);
			return next;
		});
	}

	async function handleSave() {
		const declarations = members
			.filter((m) => selected.has(m.user_id))
			.map((m) => ({
				user_id: m.user_id,
				position_id: m.position_id,
				hours: m.override_hours,
				comments: m.comments || null,
			}));

		const deletions = members
			.filter((m) => !selected.has(m.user_id) && m.submitted)
			.map((m) => ({
				user_id: m.user_id,
				position_id: m.position_id,
			}));

		if (declarations.length === 0 && deletions.length === 0) {
			toast.error("No changes to save");
			return;
		}

		setSaving(true);
		try {
			const res = await fetch(`/api/holiday-subsidy/members/${ccaId}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ day, declarations, deletions }),
			});

			if (!res.ok) {
				const json = await res.json();
				toast.error(json.error ?? "Failed to save");
				return;
			}

			const parts: string[] = [];
			if (declarations.length > 0) parts.push(`${declarations.length} saved`);
			if (deletions.length > 0) parts.push(`${deletions.length} removed`);
			toast.success(`Members updated — ${parts.join(", ")}`);
			onSaved();
			fetchMembers();
		} catch {
			toast.error("Network error");
		} finally {
			setSaving(false);
		}
	}

	const columns: ColumnDef<MemberAssignment>[] = useMemo(
		() => [
			{
				accessorKey: "name",
				header: () => <div className="font-semibold">Member</div>,
				cell: ({ row }) => (
					<div className="flex flex-col min-w-[160px]">
						<span className="font-semibold text-sm leading-tight">{row.original.name}</span>
						<span className="text-xs text-muted-foreground mt-0.5">{row.original.email}</span>
					</div>
				),
			},
			{
				accessorKey: "role",
				header: () => <div className="font-semibold">Role</div>,
				cell: ({ row }) => (
					<div className="min-w-[90px]">
						<PositionTypeBadge
							value={String(row.getValue("role"))}
							positionType={String(row.original.type)}
						/>
					</div>
				),
			},
			{
				accessorKey: "hours",
				header: () => <div className="font-semibold">Hours</div>,
				cell: ({ row }) => {
					const isOverride = row.original.override_hours !== null;
					return (
						<div className="flex items-center gap-2 min-w-[100px]">
							<Input
								type="number"
								min={0}
								max={168}
								step={0.5}
								className="w-20 text-center font-semibold"
								value={isOverride ? String(row.original.override_hours) : ""}
								onClick={(e) => e.stopPropagation()}
								onMouseDown={(e) => e.stopPropagation()}
								onChange={(e) => {
									const next = e.target.value;
									handleChange(
										row.original.user_id,
										"override_hours",
										next === "" ? null : Number(next),
									);
								}}
								placeholder={String(row.original.approved_hours)}
							/>
							<span className="text-xs text-muted-foreground">hrs</span>
						</div>
					);
				},
			},
			{
				accessorKey: "comments",
				header: () => <div className="font-semibold">Comments</div>,
				cell: ({ row }) => (
					<div className="min-w-[200px] max-w-[350px]">
						<Textarea
							className="min-h-[60px] resize-none text-sm"
							value={row.original.comments}
							onClick={(e) => e.stopPropagation()}
							onMouseDown={(e) => e.stopPropagation()}
							onChange={(e) => handleChange(row.original.user_id, "comments", e.target.value)}
							placeholder="Add a note for JCRC reviewers..."
						/>
					</div>
				),
			},
			{
				accessorKey: "status",
				header: () => <div className="font-semibold">Status</div>,
				cell: ({ row }) => {
					const st = row.original.status;
					if (!st) return <span className="text-xs text-muted-foreground">Not submitted</span>;
					const cfg = SUBSIDY_STATUS_CONFIG[st as SubsidyStatus];
					if (!cfg) return <span className="text-xs text-muted-foreground">{st}</span>;
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
				},
			},
		],
		[],
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
				No members found for approved positions on this day.
			</div>
		);
	}

	return (
		<section className="flex flex-col gap-4">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 className="text-lg font-semibold">Member Declarations — {ccaName}</h2>
					<div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
						<Info className="h-4 w-4 flex-shrink-0" />
						<span>
							{selected.size > 0 ? (
								<span className="font-medium text-foreground">
									{selected.size} member{selected.size === 1 ? "" : "s"} selected
								</span>
							) : (
								<span className="font-medium text-amber-600">
									No members selected — saving will remove all declarations
								</span>
							)}
						</span>
					</div>
				</div>
				<Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
					<Save className="h-4 w-4" />
					{saving ? "Saving..." : "Save"}
				</Button>
			</div>

			<DataTable<MemberAssignment, number>
				data={members}
				columns={columns}
				selectable
				selectedIds={selected}
				onSelectionChange={toggleSelected}
				idField="user_id"
				searchColumn="name"
				searchPlaceholder="Search members by name..."
				pageSize={20}
				emptyMessage="No members found."
			/>
		</section>
	);
}
