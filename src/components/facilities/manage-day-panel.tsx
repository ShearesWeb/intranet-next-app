"use client";

import { useState } from "react";
import { FacilityBooking, BOOKING_TYPE_CONFIG, BookingType } from "@/types/facilities";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2 } from "lucide-react";

type ManagedSlot = FacilityBooking & { claim_count: number };

interface ManageDayPanelProps {
	date: string;
	slots: ManagedSlot[];
	onDelete: (id: number) => Promise<void> | void;
	onBatchDelete: (ids: number[]) => Promise<void> | void;
}

function formatDisplayDate(dateStr: string): string {
	const d = new Date(dateStr + "T00:00:00");
	return d.toLocaleDateString("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
	});
}

function formatTime(time: string): string {
	const [h, m] = time.split(":");
	const hour = parseInt(h, 10);
	const ampm = hour >= 12 ? "PM" : "AM";
	const displayHour = hour % 12 || 12;
	return `${displayHour}:${m} ${ampm}`;
}

export function ManageDayPanel({ date, slots, onDelete, onBatchDelete }: ManageDayPanelProps) {
	const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
	const [batchDeleting, setBatchDeleting] = useState(false);
	const [deletingId, setDeletingId] = useState<number | null>(null);

	const sorted = [...slots].sort((a, b) => {
		const vCmp = a.sub_venue.localeCompare(b.sub_venue);
		if (vCmp !== 0) return vCmp;
		return a.time_from.localeCompare(b.time_from);
	});

	const deletable = sorted.filter((s) => s.claim_count === 0);

	function toggleSelect(id: number) {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	function toggleSelectAll() {
		if (selectedIds.size === deletable.length && deletable.length > 0) {
			setSelectedIds(new Set());
		} else {
			setSelectedIds(new Set(deletable.map((s) => s.id)));
		}
	}

	async function handleBatchDelete() {
		setBatchDeleting(true);
		try {
			await onBatchDelete([...selectedIds]);
			setSelectedIds(new Set());
		} finally {
			setBatchDeleting(false);
		}
	}

	async function handleDelete(id: number) {
		setDeletingId(id);
		try {
			await onDelete(id);
		} finally {
			setDeletingId(null);
		}
	}

	return (
		<div className="flex-1 min-w-0">
			<div className="mb-3 flex items-center justify-between">
				<h3 className="text-lg font-semibold">{formatDisplayDate(date)}</h3>
				{selectedIds.size > 0 && (
					<Button
						variant="destructive"
						size="sm"
						className="gap-1.5"
						isLoading={batchDeleting}
						loadingText={`Deleting ${selectedIds.size}…`}
						onClick={handleBatchDelete}
					>
						<Trash2 className="h-3.5 w-3.5" />
						Delete {selectedIds.size}
					</Button>
				)}
			</div>

			<div className="overflow-hidden rounded-lg border">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
							<th className="px-3 py-2 w-[1%]">
								{deletable.length > 0 && (
									<Checkbox
										checked={selectedIds.size === deletable.length && deletable.length > 0}
										onCheckedChange={toggleSelectAll}
									/>
								)}
							</th>
							<th className="px-3 py-2">Venue</th>
							<th className="px-3 py-2">Time</th>
							<th className="px-3 py-2">Activity</th>
							<th className="px-3 py-2">Type</th>
							<th className="px-3 py-2">Claims</th>
							<th className="px-3 py-2 w-[1%]" />
						</tr>
					</thead>
					<tbody>
						{sorted.map((slot) => {
							const typeConfig = BOOKING_TYPE_CONFIG[slot.type as BookingType];
							const hasClaims = slot.claim_count > 0;

							return (
								<tr
									key={slot.id}
									className="group border-b last:border-0 transition-colors hover:bg-accent/50"
								>
									<td className="px-3 py-2.5">
										<Checkbox
											checked={selectedIds.has(slot.id)}
											onCheckedChange={() => toggleSelect(slot.id)}
											disabled={hasClaims}
										/>
									</td>
									<td className="px-3 py-2.5">
										<div className="font-medium">{slot.sub_venue}</div>
										{slot.venue !== slot.sub_venue && (
											<div className="text-xs text-muted-foreground">{slot.venue}</div>
										)}
									</td>
									<td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
										{formatTime(slot.time_from)} – {formatTime(slot.time_to)}
									</td>
									<td className="px-3 py-2.5">{slot.activity}</td>
									<td className="px-3 py-2.5">
										<span className="inline-flex items-center gap-1.5">
											<span
												className="h-2 w-2 shrink-0 rounded-full"
												style={{
													backgroundColor: typeConfig?.color ?? "#94a3b8",
												}}
											/>
											<span className="text-muted-foreground">
												{typeConfig?.label ?? slot.type}
											</span>
										</span>
									</td>
									<td className="px-3 py-2.5">
										{hasClaims ? (
											<span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
												{slot.claim_count}
											</span>
										) : (
											<span className="text-xs text-muted-foreground">—</span>
										)}
									</td>
									<td className="px-3 py-2.5">
										<Button
											variant="ghost"
											size="icon"
											className="h-7 w-7 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
											isLoading={deletingId === slot.id}
											onClick={() => handleDelete(slot.id)}
											disabled={hasClaims}
											title={hasClaims ? "Cannot delete — has active claims" : "Delete slot"}
										>
											{deletingId === slot.id ? null : <Trash2 className="h-3.5 w-3.5" />}
										</Button>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}
