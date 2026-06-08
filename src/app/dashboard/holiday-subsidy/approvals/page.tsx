"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { PageHeader } from "@/components/layout/page-header";
import { SubsidyMonthGrid } from "@/components/holiday-subsidy/subsidy-month-grid";
import { SubsidyDayPanel } from "@/components/holiday-subsidy/subsidy-day-panel";
import { SubsidyMemberApprovalTable } from "@/components/holiday-subsidy/subsidy-member-approval-table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Clock, CheckCircle2, XCircle, Users } from "lucide-react";
import type { CalendarDeclaration } from "@/types/declarations";

function getMonthRange(year: number, month: number) {
	const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
	const lastDay = new Date(year, month + 1, 0).getDate();
	const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
	return { start, end };
}

export default function HolidaySubsidyApprovalsPage() {
	const { user } = useAuth();
	const today = new Date();
	const [year, setYear] = useState(today.getFullYear());
	const [month, setMonth] = useState(today.getMonth());
	const [selectedDate, setSelectedDate] = useState<string>(today.toISOString().split("T")[0]);
	const [declarations, setDeclarations] = useState<CalendarDeclaration[]>([]);
	const [loading, setLoading] = useState(true);
	const [memberTarget, setMemberTarget] = useState<CalendarDeclaration | null>(null);

	const isAuthorized = Boolean(user?.is_jcrc || user?.is_admin);

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

	useEffect(() => {
		fetchDeclarations();
	}, [fetchDeclarations]);

	const dayDeclarations = useMemo(() => {
		if (!selectedDate) return [];
		return declarations.filter((d) => d.day === selectedDate);
	}, [declarations, selectedDate]);

	const pendingCount = declarations.filter((d) => d.status === "pending").length;
	const approvedCount = declarations.filter((d) => d.status === "approved").length;
	const rejectedCount = declarations.filter((d) => d.status === "rejected").length;
	const memberReviewCount = declarations.filter(
		(d) => d.status === "approved" && d.member_count > 0 && d.pending_member_count > 0,
	).length;

	function handleChangeMonth(y: number, m: number) {
		setYear(y);
		setMonth(m);
		setMemberTarget(null);
	}

	function handleSelectDate(date: string) {
		setSelectedDate(date);
		setMemberTarget(null);
	}

	// Optimistically flip the declaration's local status, then reconcile with the
	// server. On failure we restore the previous status and surface the error.
	function applyOptimisticStatus(id: number, status: CalendarDeclaration["status"]) {
		setDeclarations((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)));
	}

	async function handleApprove(decl: CalendarDeclaration) {
		const previousStatus = decl.status;
		applyOptimisticStatus(decl.id, "approved");
		try {
			const res = await fetch(`/api/holiday-subsidy/approvals/${decl.cca_id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					updates: [{ subsidyId: decl.id, status: "approved" }],
				}),
			});
			if (!res.ok) {
				const json = await res.json();
				applyOptimisticStatus(decl.id, previousStatus);
				toast.error(json.error ?? "Failed to approve");
				return;
			}
			toast.success(`Approved — ${decl.cca_name}`);
			fetchDeclarations();
		} catch {
			applyOptimisticStatus(decl.id, previousStatus);
			toast.error("Network error");
		}
	}

	async function handleReject(decl: CalendarDeclaration) {
		const previousStatus = decl.status;
		applyOptimisticStatus(decl.id, "rejected");
		try {
			const res = await fetch(`/api/holiday-subsidy/approvals/${decl.cca_id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					updates: [{ subsidyId: decl.id, status: "rejected" }],
				}),
			});
			if (!res.ok) {
				const json = await res.json();
				applyOptimisticStatus(decl.id, previousStatus);
				toast.error(json.error ?? "Failed to reject");
				return;
			}
			toast.success(`Rejected — ${decl.cca_name}`);
			if (memberTarget?.id === decl.id) {
				setMemberTarget(null);
			}
			fetchDeclarations();
		} catch {
			applyOptimisticStatus(decl.id, previousStatus);
			toast.error("Network error");
		}
	}

	function handleReviewMembers(decl: CalendarDeclaration) {
		setMemberTarget(decl);
	}

	if (!isAuthorized) {
		return (
			<div className="flex flex-col space-y-6 p-4 md:p-6 max-w-3xl">
				<PageHeader title="Holiday Subsidy Approvals" />
				<Card>
					<CardContent className="p-6 space-y-2">
						<div className="text-lg font-semibold">JCRC access only</div>
						<p className="text-sm text-muted-foreground">
							This page is restricted to JCRC members responsible for approving subsidy
							declarations.
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			<PageHeader
				title="Subsidy Approvals"
				description="Review and approve CCA subsidy declarations across all CCAs."
			/>

			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<div className="rounded-lg border bg-card p-4">
					<div className="flex items-center gap-2">
						<Clock className="h-4 w-4 text-[#fbbf24]" />
						<span className="text-xs font-medium text-muted-foreground">Pending</span>
					</div>
					{loading ? (
						<Skeleton className="mt-2 h-8 w-10" />
					) : (
						<div className="mt-2 text-2xl font-bold tabular-nums text-[#fbbf24]">{pendingCount}</div>
					)}
				</div>
				<div className="rounded-lg border bg-card p-4">
					<div className="flex items-center gap-2">
						<Users className="h-4 w-4 text-[#3b82f6]" />
						<span className="text-xs font-medium text-muted-foreground">Member Declarations</span>
					</div>
					{loading ? (
						<Skeleton className="mt-2 h-8 w-10" />
					) : (
						<div className="mt-2 text-2xl font-bold tabular-nums text-[#3b82f6]">
							{memberReviewCount}
						</div>
					)}
				</div>
				<div className="rounded-lg border bg-card p-4">
					<div className="flex items-center gap-2">
						<CheckCircle2 className="h-4 w-4 text-[#10b981]" />
						<span className="text-xs font-medium text-muted-foreground">Approved</span>
					</div>
					{loading ? (
						<Skeleton className="mt-2 h-8 w-10" />
					) : (
						<div className="mt-2 text-2xl font-bold tabular-nums text-[#10b981]">
							{approvedCount}
						</div>
					)}
				</div>
				<div className="rounded-lg border bg-card p-4">
					<div className="flex items-center gap-2">
						<XCircle className="h-4 w-4 text-[#f87171]" />
						<span className="text-xs font-medium text-muted-foreground">Rejected</span>
					</div>
					{loading ? (
						<Skeleton className="mt-2 h-8 w-10" />
					) : (
						<div className="mt-2 text-2xl font-bold tabular-nums text-[#f87171]">
							{rejectedCount}
						</div>
					)}
				</div>
			</div>

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
							isChair={false}
							isJcrc={true}
							onApprove={handleApprove}
							onReject={handleReject}
							onAssignMembers={handleReviewMembers}
						/>
					) : (
						<p className="text-sm text-muted-foreground">Select a day to review declarations.</p>
					)}
				</div>
			</div>

			{memberTarget && (
				<SubsidyMemberApprovalTable
					ccaId={memberTarget.cca_id}
					ccaName={memberTarget.cca_name}
					day={memberTarget.day}
					onSaved={fetchDeclarations}
				/>
			)}
		</div>
	);
}
