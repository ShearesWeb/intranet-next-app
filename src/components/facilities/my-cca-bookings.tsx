"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { EmptyState } from "@/components/layout/empty-state";
import { MonthGrid } from "@/components/facilities/month-grid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCalendarMonth } from "@/hooks/use-calendar-month";
import {
	SlotWithContext,
	ClaimStatus,
	CLAIM_STATUS_CONFIG,
	FACILITY_TYPE_CONFIG,
	FacilityType,
	formatHourRange,
} from "@/types/facilities";
import { toast } from "sonner";
import { Calendar, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDisplayDate } from "@/lib/date";

interface ClaimRow {
	id: number;
	facility_id: number;
	date: string;
	hour: number;
	cca_id: number;
	cca_name: string;
	status: ClaimStatus;
	venue: string;
	sub_venue: string;
	facility_type: FacilityType;
}

// No cancelled tab — a withdrawn claim is the chair's own action, not worth surfacing.
const STATUS_TABS: ClaimStatus[] = ["approved", "pending", "rejected"];

/** A chair's claims split by status: calendar to navigate, list that always shows everything. */
export function MyCcaBookings() {
	const { user } = useAuth();
	const { year, month, changeMonth } = useCalendarMonth();
	const [dateFilter, setDateFilter] = useState<string | null>(null);
	const [claims, setClaims] = useState<ClaimRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [ccaFilter, setCcaFilter] = useState<number | null>(null);
	const [busyId, setBusyId] = useState<number | null>(null);

	const chairCcas = useMemo(() => {
		if (!user) return [];
		return user.appointments
			.filter((a) => a.position_type === "lead" || a.position_type === "vice")
			.map((a) => ({ id: a.cca_id, name: a.cca_name }));
	}, [user]);

	const chairCcaIds = useMemo(() => chairCcas.map((c) => c.id), [chairCcas]);

	const fetchClaims = useCallback(async () => {
		if (chairCcaIds.length === 0) {
			setLoading(false);
			return;
		}
		setLoading(true);
		try {
			const results = await Promise.all(
				chairCcaIds.map((id) =>
					fetch(`/api/facilities/claims?ccaId=${id}`)
						.then((r) => (r.ok ? r.json() : { data: [] }))
						.then((j) => (j.data ?? []) as ClaimRow[]),
				),
			);
			setClaims(results.flat());
		} catch {
			toast.error("Failed to load bookings");
		} finally {
			setLoading(false);
		}
	}, [chairCcaIds]);

	useEffect(() => {
		fetchClaims();
	}, [fetchClaims]);

	const visible = useMemo(
		() => (ccaFilter === null ? claims : claims.filter((c) => c.cca_id === ccaFilter)),
		[claims, ccaFilter],
	);

	async function handleWithdraw(claimId: number) {
		setBusyId(claimId);
		try {
			const res = await fetch(`/api/facilities/claims/${claimId}`, { method: "DELETE" });
			if (!res.ok) {
				const json = await res.json();
				toast.error(json.error ?? "Failed to withdraw");
				return;
			}
			toast.success("Booking withdrawn");
			fetchClaims();
		} catch {
			toast.error("Network error");
		} finally {
			setBusyId(null);
		}
	}

	if (chairCcas.length === 0) return null;

	if (loading) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-16 w-full" />
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{chairCcas.length > 1 && (
				<div className="flex flex-wrap gap-1.5">
					<button
						onClick={() => setCcaFilter(null)}
						className={cn(
							"rounded-full px-3 py-1 text-xs font-medium transition-all active:scale-95",
							ccaFilter === null
								? "bg-primary text-primary-foreground shadow-sm"
								: "bg-muted text-muted-foreground hover:bg-muted/80",
						)}
					>
						All CCAs
					</button>
					{chairCcas.map((cca) => (
						<button
							key={cca.id}
							onClick={() => setCcaFilter(ccaFilter === cca.id ? null : cca.id)}
							className={cn(
								"rounded-full px-3 py-1 text-xs font-medium transition-all active:scale-95",
								ccaFilter === cca.id
									? "bg-primary text-primary-foreground shadow-sm"
									: "bg-muted text-muted-foreground hover:bg-muted/80",
							)}
						>
							{cca.name}
						</button>
					))}
				</div>
			)}

			<Tabs defaultValue="approved">
				<TabsList>
					{STATUS_TABS.map((status) => (
						<TabsTrigger key={status} value={status}>
							{CLAIM_STATUS_CONFIG[status].label}
						</TabsTrigger>
					))}
				</TabsList>

				{STATUS_TABS.map((status) => (
					<StatusCalendar
						key={status}
						status={status}
						claims={visible.filter((c) => c.status === status)}
						year={year}
						month={month}
						dateFilter={dateFilter}
						onSelectDate={(d) => setDateFilter((prev) => (prev === d ? null : d))}
						onClearDate={() => setDateFilter(null)}
						onChangeMonth={changeMonth}
						busyId={busyId}
						onWithdraw={handleWithdraw}
					/>
				))}
			</Tabs>
		</div>
	);
}

function StatusCalendar({
	status,
	claims,
	year,
	month,
	dateFilter,
	onSelectDate,
	onClearDate,
	onChangeMonth,
	busyId,
	onWithdraw,
}: {
	status: ClaimStatus;
	claims: ClaimRow[];
	year: number;
	month: number;
	dateFilter: string | null;
	onSelectDate: (date: string) => void;
	onClearDate: () => void;
	onChangeMonth: (year: number, month: number) => void;
	busyId: number | null;
	onWithdraw: (claimId: number) => void;
}) {
	const statusConfig = CLAIM_STATUS_CONFIG[status];

	// MonthGrid renders SlotWithContext; project each claim into that shape.
	const calendarBookings = useMemo<SlotWithContext[]>(
		() =>
			claims.map((c) => ({
				facility_id: c.facility_id,
				venue: c.venue,
				sub_venue: c.sub_venue,
				type: c.facility_type,
				date: c.date,
				hour: c.hour,
				status: c.status === "approved" ? "confirmed" : "pending",
				live_claims: 1,
				claims: [],
				user_cca_claim: null,
			})),
		[claims],
	);

	// The list always shows every claim of this status; a selected day narrows it.
	const listed = useMemo(() => {
		const base = dateFilter ? claims.filter((c) => c.date === dateFilter) : claims;
		return [...base].sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour);
	}, [claims, dateFilter]);

	return (
		<TabsContent value={status}>
			{claims.length === 0 ? (
				<EmptyState
					icon={Calendar}
					title={`No ${statusConfig.label.toLowerCase()} bookings`}
					description="Slots you claim show up here by status."
				/>
			) : (
				<div className="flex flex-col gap-6 lg:flex-row">
					<div className="w-full lg:w-[320px] shrink-0">
						<MonthGrid
							year={year}
							month={month}
							selectedDate={dateFilter}
							bookings={calendarBookings}
							onSelectDate={onSelectDate}
							onChangeMonth={onChangeMonth}
						/>
					</div>

					<div className="min-w-0 flex-1 space-y-3">
						<div className="flex items-center justify-between gap-2">
							<h3 className="text-sm font-semibold">
								{statusConfig.label} bookings ({listed.length})
							</h3>
							{dateFilter && (
								<button
									type="button"
									onClick={onClearDate}
									className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/80"
								>
									{formatDisplayDate(dateFilter)}
									<X className="h-3 w-3" />
								</button>
							)}
						</div>
						{listed.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No {statusConfig.label.toLowerCase()} bookings on this day.
							</p>
						) : (
							<div className="space-y-2">
								{listed.map((claim) => (
									<ClaimDayRow
										key={claim.id}
										claim={claim}
										busy={busyId === claim.id}
										onWithdraw={onWithdraw}
									/>
								))}
							</div>
						)}
					</div>
				</div>
			)}
		</TabsContent>
	);
}

function ClaimDayRow({
	claim,
	busy,
	onWithdraw,
}: {
	claim: ClaimRow;
	busy: boolean;
	onWithdraw: (claimId: number) => void;
}) {
	const statusConfig = CLAIM_STATUS_CONFIG[claim.status];
	const typeConfig = FACILITY_TYPE_CONFIG[claim.facility_type];
	// Contention is a property of the slot, not the claim, and this list is
	// claim-shaped — so a pending claim simply reads as awaiting approval.
	const awaitingApproval = claim.status === "pending";
	const canWithdraw = claim.status === "pending" || claim.status === "approved";
	const solid = claim.status === "approved";

	return (
		<div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm">
			<div className="min-w-0">
				<div className="flex items-center gap-1.5 font-medium">
					<span
						className="h-2 w-2 shrink-0 rounded-full"
						style={{ backgroundColor: typeConfig.color }}
					/>
					{claim.sub_venue}
				</div>
				<div className="text-xs text-muted-foreground">
					{formatDisplayDate(claim.date, {
						weekday: "short",
						month: "short",
						day: "numeric",
					})}{" "}
					· {formatHourRange(claim.hour)} · {claim.cca_name}
				</div>
				{awaitingApproval && (
					<span className="text-[10px] text-muted-foreground">Awaiting JCRC approval</span>
				)}
			</div>
			<div className="flex shrink-0 items-center gap-2">
				<Badge
					variant={solid ? "default" : "outline"}
					style={
						solid
							? { backgroundColor: statusConfig.color, color: "#fff" }
							: { borderColor: statusConfig.color, color: statusConfig.color }
					}
				>
					{statusConfig.label}
				</Badge>
				{canWithdraw && (
					<Button
						size="sm"
						variant="destructive"
						className="h-7 text-xs"
						isLoading={busy}
						loadingText="Withdrawing…"
						onClick={() => onWithdraw(claim.id)}
					>
						Withdraw
					</Button>
				)}
			</div>
		</div>
	);
}
