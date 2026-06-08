"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { PageHeader } from "@/components/layout/page-header";
import { SubsidyMonthGrid } from "@/components/holiday-subsidy/subsidy-month-grid";
import { SubsidyDayPanel } from "@/components/holiday-subsidy/subsidy-day-panel";
import { SubsidyDeclareDialog } from "@/components/holiday-subsidy/subsidy-declare-dialog";
import { SubsidyStatsCards } from "@/components/holiday-subsidy/subsidy-stats-cards";
import { SubsidyMemberTable } from "@/components/holiday-subsidy/subsidy-member-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { CalendarDeclaration, PositionOption } from "@/types/declarations";

function getMonthRange(year: number, month: number) {
	const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
	const lastDay = new Date(year, month + 1, 0).getDate();
	const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
	return { start, end };
}

export default function HolidaySubsidyPage() {
	const { user } = useAuth();
	const today = new Date();
	const [year, setYear] = useState(today.getFullYear());
	const [month, setMonth] = useState(today.getMonth());
	const [selectedDate, setSelectedDate] = useState<string>(today.toISOString().split("T")[0]);
	const [declarations, setDeclarations] = useState<CalendarDeclaration[]>([]);
	const [positionsByCca, setPositionsByCca] = useState<Map<number, PositionOption[]>>(new Map());
	const [loading, setLoading] = useState(true);

	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingDecl, setEditingDecl] = useState<CalendarDeclaration | null>(null);
	const [memberTarget, setMemberTarget] = useState<CalendarDeclaration | null>(null);
	const [pendingDelete, setPendingDelete] = useState<CalendarDeclaration | null>(null);
	const [deleting, setDeleting] = useState(false);

	const chairCcas = useMemo(() => {
		if (!user) return [];
		const seen = new Set<number>();
		return user.appointments
			.filter((a) => a.position_type === "lead" || a.position_type === "vice")
			.filter((a) => {
				if (seen.has(a.cca_id)) return false;
				seen.add(a.cca_id);
				return true;
			})
			.map((a) => ({ id: a.cca_id, name: a.cca_name }));
	}, [user]);

	const isChair = chairCcas.length > 0;

	const fetchDeclarations = useCallback(async () => {
		const { start, end } = getMonthRange(year, month);
		setLoading(true);
		try {
			const res = await fetch(`/api/holiday-subsidy/calendar?start=${start}&end=${end}`);
			const json = await res.json();
			if (res.ok) {
				setDeclarations(json.data?.declarations ?? []);
			}
		} catch {
			// fetch failed
		} finally {
			setLoading(false);
		}
	}, [year, month]);

	const fetchPositions = useCallback(async () => {
		if (!chairCcas.length) return;
		const map = new Map<number, PositionOption[]>();
		await Promise.all(
			chairCcas.map(async (cca) => {
				try {
					const res = await fetch(`/api/holiday-subsidy/declarations/${cca.id}`);
					const json = await res.json();
					if (res.ok) {
						map.set(cca.id, json.data?.positions ?? []);
					}
				} catch {
					// skip
				}
			}),
		);
		setPositionsByCca(map);
	}, [chairCcas]);

	useEffect(() => {
		fetchDeclarations();
	}, [fetchDeclarations]);

	useEffect(() => {
		fetchPositions();
	}, [fetchPositions]);

	const dayDeclarations = useMemo(() => {
		if (!selectedDate) return [];
		return declarations.filter((d) => d.day === selectedDate);
	}, [declarations, selectedDate]);

	function handleChangeMonth(y: number, m: number) {
		setYear(y);
		setMonth(m);
		setMemberTarget(null);
	}

	function handleSelectDate(date: string) {
		setSelectedDate(date);
		setMemberTarget(null);
	}

	function handleDeclare() {
		setEditingDecl(null);
		setDialogOpen(true);
	}

	function handleEdit(decl: CalendarDeclaration) {
		setEditingDecl(decl);
		setDialogOpen(true);
	}

	function handleDelete(decl: CalendarDeclaration) {
		setPendingDelete(decl);
	}

	async function confirmDelete() {
		if (!pendingDelete) return;
		const decl = pendingDelete;
		setDeleting(true);
		try {
			const res = await fetch(`/api/holiday-subsidy/declarations/${decl.cca_id}`, {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ subsidyId: decl.id }),
			});
			if (!res.ok) {
				const json = await res.json();
				toast.error(json.error ?? "Failed to delete");
				return;
			}
			toast.success("Declaration deleted");
			setPendingDelete(null);
			fetchDeclarations();
		} catch {
			toast.error("Network error");
		} finally {
			setDeleting(false);
		}
	}

	function handleAssignMembers(decl: CalendarDeclaration) {
		setMemberTarget(decl);
	}

	if (!isChair) {
		return (
			<div className="flex flex-col space-y-6 p-4 md:p-6">
				<PageHeader title="Holiday Subsidy" description="You are not a chair/vice for any CCA." />
				<div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
					Only CCA leads and vice leads can submit holiday subsidy declarations.
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			<PageHeader
				title="Holiday Subsidy"
				description="Declare and track holiday subsidy hours for your CCA."
			/>

			<SubsidyStatsCards declarations={declarations} loading={loading} />

			<div className="flex flex-col gap-6 lg:flex-row">
				<div className="w-full lg:w-[320px] shrink-0">
					{loading ? (
						<Skeleton className="h-[360px] w-full rounded-lg" />
					) : (
						<SubsidyMonthGrid
							year={year}
							month={month}
							selectedDate={selectedDate}
							declarations={declarations}
							onSelectDate={handleSelectDate}
							onChangeMonth={handleChangeMonth}
						/>
					)}
				</div>

				<div className="flex-1 min-w-0">
					{loading ? (
						<div className="space-y-3">
							<Skeleton className="h-6 w-48" />
							<Skeleton className="h-16 w-full" />
							<Skeleton className="h-16 w-full" />
						</div>
					) : selectedDate ? (
						<SubsidyDayPanel
							date={selectedDate}
							declarations={dayDeclarations}
							isChair={isChair}
							isJcrc={false}
							onDeclare={handleDeclare}
							onEdit={handleEdit}
							onDelete={handleDelete}
							onAssignMembers={handleAssignMembers}
						/>
					) : (
						<p className="text-sm text-muted-foreground">Select a day to view declarations.</p>
					)}
				</div>
			</div>

			{memberTarget && (
				<SubsidyMemberTable
					ccaId={memberTarget.cca_id}
					ccaName={memberTarget.cca_name}
					day={memberTarget.day}
					onSaved={fetchDeclarations}
				/>
			)}

			<SubsidyDeclareDialog
				chairCcas={chairCcas}
				positionsByCca={positionsByCca}
				date={selectedDate}
				open={dialogOpen}
				editing={editingDecl}
				onOpenChange={setDialogOpen}
				onSuccess={fetchDeclarations}
			/>

			<Dialog
				open={pendingDelete !== null}
				onOpenChange={(open) => {
					if (!open && !deleting) setPendingDelete(null);
				}}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Delete declaration?</DialogTitle>
						<DialogDescription>
							{pendingDelete
								? `This permanently removes the ${pendingDelete.position_name} subsidy declaration for ${pendingDelete.cca_name}. This action cannot be undone.`
								: "This action cannot be undone."}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setPendingDelete(null)} disabled={deleting}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={confirmDelete}
							isLoading={deleting}
							loadingText="Deleting…"
						>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
