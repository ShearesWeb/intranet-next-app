"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DashedEmpty } from "@/components/shared/inline-states";
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
import { useApiQuery } from "@/hooks/use-api-query";
import { useCalendarMonth } from "@/hooks/use-calendar-month";
import { useChairCcas } from "@/hooks/use-chair-ccas";
import { toast } from "sonner";
import type { CalendarDeclaration, PositionOption } from "@/types/declarations";

export default function HolidaySubsidyPage() {
	const { year, month, selectedDate, setSelectedDate, changeMonth, monthRange } =
		useCalendarMonth();
	const [positionsByCca, setPositionsByCca] = useState<Map<number, PositionOption[]>>(new Map());

	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingDecl, setEditingDecl] = useState<CalendarDeclaration | null>(null);
	const [memberTarget, setMemberTarget] = useState<CalendarDeclaration | null>(null);
	const [pendingDelete, setPendingDelete] = useState<CalendarDeclaration | null>(null);
	const [deleting, setDeleting] = useState(false);

	const { chairCcas, isChair } = useChairCcas();

	const {
		data,
		loading,
		refetch: fetchDeclarations,
	} = useApiQuery<CalendarDeclaration[]>(
		`/api/holiday-subsidy/calendar?start=${monthRange.start}&end=${monthRange.end}`,
		{
			select: (json) =>
				(json as { data?: { declarations?: CalendarDeclaration[] } }).data?.declarations ?? [],
		},
	);
	const declarations = useMemo(() => data ?? [], [data]);

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
		fetchPositions();
	}, [fetchPositions]);

	const dayDeclarations = useMemo(() => {
		if (!selectedDate) return [];
		return declarations.filter((d) => d.day === selectedDate);
	}, [declarations, selectedDate]);

	function handleChangeMonth(y: number, m: number) {
		changeMonth(y, m);
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
				<DashedEmpty className="p-8">
					Only CCA leads and vice leads can submit holiday subsidy declarations.
				</DashedEmpty>
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
