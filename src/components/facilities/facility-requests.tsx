"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	DayHeading,
	FACILITY_CARD_CLASS,
	FacilityEmpty,
} from "@/components/facilities/facility-ui";
import {
	ClaimSegment,
	GRID_HOURS,
	RequestCluster,
	clusterRequests,
	columnRuns,
	facilityLabel,
	formatClock,
	formatDayLabel,
	formatDuration,
	formatHourSpan,
	formatRequestedAgo,
	groupClaimSegments,
	relativeDayLabel,
} from "@/lib/facilities/booking-grid";
import { decideClaims, errorMessage } from "@/lib/facilities/facility-client";
import {
	ApprovalsPayload,
	ReviewClaim,
	confirmedClaims,
	pendingClaims,
} from "@/lib/facilities/request-view";
import { getSingaporeDateKey } from "@/lib/nus-academic-calendar";
import { cn } from "@/lib/utils";

interface FacilityRequestsProps {
	approvals: ApprovalsPayload;
	onChanged: () => Promise<unknown>;
}

type Segment = ClaimSegment<ReviewClaim>;

function telegramHandle(handle: string): string {
	return handle && !handle.startsWith("@") ? `@${handle}` : handle;
}

/** JCRC's queue: requests to decide, and upcoming confirmed bookings to revoke. */
export function FacilityRequests({ approvals, onChanged }: FacilityRequestsProps) {
	const [view, setView] = useState<"review" | "confirmed">("review");
	const [askingRevoke, setAskingRevoke] = useState<number | null>(null);
	const [busy, setBusy] = useState(false);
	const today = getSingaporeDateKey();

	const venueNames = useMemo(() => {
		const names = new Map<number, string>();
		for (const { slot } of [...approvals.pending, ...approvals.confirmed]) {
			names.set(slot.facility_id, facilityLabel(slot));
		}
		return names;
	}, [approvals]);

	const pending = useMemo(() => groupClaimSegments(pendingClaims(approvals)), [approvals]);
	const clusters = useMemo(() => clusterRequests(pending), [pending]);
	const singles = useMemo(
		() => clusters.filter((cluster) => cluster.items.length === 1).map((c) => c.items[0]),
		[clusters],
	);
	const conflictCount = clusters.length - singles.length;
	const reviewDays = useMemo(
		() => [...new Set(clusters.map((cluster) => cluster.date))].sort(),
		[clusters],
	);

	const confirmed = useMemo(
		() =>
			groupClaimSegments(confirmedClaims(approvals)).sort(
				(a, b) => a.date.localeCompare(b.date) || a.start - b.start,
			),
		[approvals],
	);
	const confirmedDays = useMemo(
		() => [...new Set(confirmed.map((segment) => segment.date))],
		[confirmed],
	);

	async function run(action: () => Promise<void>, success: string) {
		setBusy(true);
		try {
			await action();
			toast.success(success);
			setAskingRevoke(null);
			await onChanged();
		} catch (error) {
			toast.error(errorMessage(error, "Action failed"));
		} finally {
			setBusy(false);
		}
	}

	function describe(segment: Segment): string {
		return `${venueNames.get(segment.facility_id)} · ${formatDayLabel(segment.date).split(" ")[0]} ${formatHourSpan(segment.start, segment.end)}`;
	}

	const isReview = view === "review";

	return (
		<div className="flex flex-col gap-[18px]">
			<div className="flex flex-wrap items-center gap-2.5">
				<div className="flex gap-0.5 rounded-[10px] bg-muted p-[3px]">
					<SegmentButton active={isReview} onClick={() => setView("review")}>
						To review · {pending.length}
					</SegmentButton>
					<SegmentButton active={!isReview} onClick={() => setView("confirmed")}>
						Upcoming confirmed · {confirmed.length}
					</SegmentButton>
				</div>
				<span className="text-[13px] text-muted-foreground">
					{isReview
						? conflictCount
							? `${conflictCount} conflict${conflictCount > 1 ? "s" : ""} need a decision`
							: "No conflicts"
						: "Revoking reopens the slot for other CCAs"}
				</span>
				{isReview && singles.length > 0 && (
					<Button
						disabled={busy}
						onClick={() =>
							run(
								() =>
									decideClaims(
										"approve",
										singles.flatMap((segment) => segment.claim_ids),
									),
								`Approved ${singles.length} request${singles.length > 1 ? "s" : ""}`,
							)
						}
						className="ml-auto rounded-[10px] font-bold hover:bg-fac-primary-hover"
					>
						Approve {singles.length} uncontested
					</Button>
				)}
			</div>

			{isReview ? (
				<div className="flex flex-col gap-6">
					{pending.length === 0 && (
						<FacilityEmpty>All caught up. New requests from CCA chairs land here.</FacilityEmpty>
					)}
					{reviewDays.map((date) => {
						const dayClusters = clusters.filter((cluster) => cluster.date === date);
						const daySingles = dayClusters.filter((cluster) => cluster.items.length === 1);
						return (
							<div key={date} className="flex flex-col gap-3">
								<DayHeading label={formatDayLabel(date)} relative={relativeDayLabel(date, today)} />
								{dayClusters
									.filter((cluster) => cluster.items.length > 1)
									.map((cluster) => (
										<ConflictCard
											key={`${cluster.facility_id}:${cluster.start}`}
											cluster={cluster}
											venue={venueNames.get(cluster.facility_id) ?? ""}
											today={today}
											busy={busy}
											onApprove={(winner) =>
												run(
													() =>
														decideClaims(
															"approve",
															winner.claim_ids,
															cluster.items
																.filter((item) => item !== winner)
																.flatMap((item) => item.claim_ids),
														),
													`Approved ${winner.cca_name} · others declined`,
												)
											}
										/>
									))}
								{daySingles.length > 0 && (
									<div className={cn(FACILITY_CARD_CLASS, "overflow-hidden")}>
										{daySingles.map((cluster, index) => {
											const segment = cluster.items[0];
											const claim = segment.claims[0];
											return (
												<RequestRow
													key={segment.claim_ids[0]}
													divided={index > 0}
													cca={segment.cca_name}
													subtitle={[
														claim.chair_name,
														formatRequestedAgo(claim.requested_at, today).replace(
															"Requested",
															"requested",
														),
													]
														.filter(Boolean)
														.join(" · ")}
													venue={venueNames.get(segment.facility_id) ?? ""}
													segment={segment}
												>
													<div className="flex gap-2">
														<Button
															size="sm"
															disabled={busy}
															aria-label={`Approve ${segment.cca_name} request`}
															onClick={() =>
																run(
																	() => decideClaims("approve", segment.claim_ids),
																	`Approved ${segment.cca_name} · ${describe(segment)}`,
																)
															}
															className="rounded-[10px] px-3.5 text-[13px] font-bold hover:bg-fac-primary-hover"
														>
															Approve
														</Button>
														<DangerOutlineButton
															disabled={busy}
															label={`Decline ${segment.cca_name} request`}
															onClick={() =>
																run(
																	() => decideClaims("reject", segment.claim_ids),
																	`Declined ${segment.cca_name}`,
																)
															}
														>
															Decline
														</DangerOutlineButton>
													</div>
												</RequestRow>
											);
										})}
									</div>
								)}
							</div>
						);
					})}
				</div>
			) : (
				<div className="flex flex-col gap-6">
					{confirmed.length === 0 && <FacilityEmpty>No upcoming confirmed bookings.</FacilityEmpty>}
					{confirmedDays.map((date) => (
						<div key={date} className="flex flex-col gap-3">
							<DayHeading label={formatDayLabel(date)} relative={relativeDayLabel(date, today)} />
							<div className={cn(FACILITY_CARD_CLASS, "overflow-hidden")}>
								{confirmed
									.filter((segment) => segment.date === date)
									.map((segment, index) => {
										const key = segment.claim_ids[0];
										return (
											<RequestRow
												key={key}
												divided={index > 0}
												cca={segment.cca_name}
												subtitle={segment.claims[0].chair_name}
												venue={venueNames.get(segment.facility_id) ?? ""}
												segment={segment}
											>
												{askingRevoke === key ? (
													<div className="flex items-center gap-2">
														<span className="text-[12.5px] text-muted-foreground">
															Reopen this slot?
														</span>
														<Button
															size="sm"
															variant="destructive"
															isLoading={busy}
															onClick={() =>
																run(
																	() => decideClaims("revoke", segment.claim_ids),
																	`Booking revoked · ${describe(segment)} reopened`,
																)
															}
															className="rounded-[10px] text-[13px] font-bold"
														>
															Revoke
														</Button>
														<Button
															size="sm"
															variant="outline"
															disabled={busy}
															onClick={() => setAskingRevoke(null)}
															className="rounded-[10px] bg-card text-[13px]"
														>
															Keep
														</Button>
													</div>
												) : (
													<DangerOutlineButton
														disabled={busy}
														label={`Revoke ${segment.cca_name} booking`}
														onClick={() => setAskingRevoke(key)}
													>
														Revoke
													</DangerOutlineButton>
												)}
											</RequestRow>
										);
									})}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function SegmentButton({
	active,
	onClick,
	children,
}: {
	active: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			aria-pressed={active}
			onClick={onClick}
			className={cn(
				"h-8 cursor-pointer rounded-[8px] px-3.5 text-[13px] font-semibold",
				active ? "bg-card text-foreground shadow-xs" : "text-muted-foreground",
			)}
		>
			{children}
		</button>
	);
}

function DangerOutlineButton({
	label,
	disabled,
	onClick,
	children,
}: {
	label: string;
	disabled: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<Button
			size="sm"
			variant="outline"
			aria-label={label}
			disabled={disabled}
			onClick={onClick}
			className="rounded-[10px] bg-card text-[13px] text-destructive shadow-none hover:bg-fac-danger hover:text-destructive"
		>
			{children}
		</Button>
	);
}

function RequestRow({
	divided,
	cca,
	subtitle,
	venue,
	segment,
	children,
}: {
	divided: boolean;
	cca: string;
	subtitle: string;
	venue: string;
	segment: Segment;
	children: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				"flex flex-wrap items-center gap-x-4 gap-y-2 px-[18px] py-3",
				divided && "border-t",
			)}
		>
			<div className="flex min-w-0 flex-[1_1_180px] flex-col gap-0.5">
				<span className="text-sm font-bold">{cca}</span>
				{subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
			</div>
			<span className="flex-[1_1_140px] text-[13.5px] font-semibold">{venue}</span>
			<span className="flex-[1_1_150px] text-[13.5px]">
				{formatHourSpan(segment.start, segment.end)}{" "}
				<span className="text-muted-foreground">
					· {formatDuration(segment.end - segment.start)}
				</span>
			</span>
			{children}
		</div>
	);
}

/** Competing CCAs side by side on a shared timeline, with the overlap hatched. */
function ConflictCard({
	cluster,
	venue,
	today,
	busy,
	onApprove,
}: {
	cluster: RequestCluster<ReviewClaim>;
	venue: string;
	today: string;
	busy: boolean;
	onApprove: (winner: Segment) => void;
}) {
	const span = cluster.end - cluster.start;
	const counts = new Map<number, number>();
	for (const item of cluster.items) {
		for (let column = item.start; column < item.end; column++) {
			counts.set(column, (counts.get(column) ?? 0) + 1);
		}
	}
	const overlap = [...counts.entries()].filter(([, count]) => count > 1).map(([column]) => column);
	const overlapLabel = columnRuns(overlap)
		.map(([start, end]) => formatHourSpan(start, end))
		.join(", ");
	const endHour = (GRID_HOURS[cluster.end - 1] + 1) % 24;

	return (
		<div className="overflow-hidden rounded-[12px] border border-fac-danger-line bg-card shadow-sm">
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-fac-danger-line bg-fac-danger px-[18px] py-3">
				<span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">
					Conflict · {cluster.items.length} CCAs
				</span>
				<span className="text-[15px] font-bold">{venue}</span>
				<span className="text-[13px]">{formatHourSpan(cluster.start, cluster.end)}</span>
				<span className="ml-auto text-[12.5px] font-semibold text-red-700">
					Overlap {overlapLabel}
				</span>
			</div>
			<div className="grid gap-3 px-[18px] py-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr))]">
				{cluster.items.map((item) => {
					const claim = item.claims[0];
					const others = cluster.items
						.filter((other) => other !== item)
						.map((other) => other.cca_name)
						.join(" and ");
					const itemOverlap = overlap.filter((column) => column >= item.start && column < item.end);
					return (
						<div
							key={item.claim_ids[0]}
							className="flex flex-col gap-2.5 rounded-[10px] border p-3.5"
						>
							<div className="flex items-baseline justify-between gap-2">
								<span className="text-[15px] font-bold">{item.cca_name}</span>
								<span className="whitespace-nowrap text-xs text-muted-foreground">
									{formatRequestedAgo(claim.requested_at, today)}
								</span>
							</div>
							<span className="text-[13px] font-semibold">
								{formatHourSpan(item.start, item.end)} · {formatDuration(item.end - item.start)}
							</span>
							<div className="flex flex-col gap-1">
								<div className="relative h-3 rounded-full bg-muted">
									<div
										className="absolute inset-y-0 rounded-full bg-fac-dash"
										style={{
											left: `${((item.start - cluster.start) / span) * 100}%`,
											width: `${((item.end - item.start) / span) * 100}%`,
										}}
									/>
									{columnRuns(itemOverlap).map(([start, end]) => (
										<div
											key={start}
											className="absolute inset-y-0 rounded-[3px] bg-[repeating-linear-gradient(135deg,#dc2626_0_3px,#f87171_3px_6px)]"
											style={{
												left: `${((start - cluster.start) / span) * 100}%`,
												width: `${((end - start) / span) * 100}%`,
											}}
										/>
									))}
								</div>
								<div className="flex justify-between text-[10.5px] font-semibold text-muted-foreground">
									<span>{formatClock(GRID_HOURS[cluster.start])}</span>
									<span>{formatClock(endHour)}</span>
								</div>
							</div>
							{(claim.chair_name || claim.chair_telegram) && (
								<span className="text-xs text-muted-foreground">
									{claim.chair_name}
									{claim.chair_name && claim.chair_telegram ? " · " : ""}
									<span className="font-mono text-[11px]">
										{telegramHandle(claim.chair_telegram)}
									</span>
								</span>
							)}
							<div className="rounded-[8px] bg-muted px-2.5 py-2 text-[12.5px] leading-[1.45]">
								Approving declines {others}.
							</div>
							<Button
								size="sm"
								disabled={busy}
								onClick={() => onApprove(item)}
								className="h-[34px] rounded-[10px] text-[13px] font-bold hover:bg-fac-primary-hover"
							>
								Approve {item.cca_name}
							</Button>
						</div>
					);
				})}
			</div>
		</div>
	);
}
