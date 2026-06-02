"use client";

import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FacilitySlotWithClaims, BOOKING_TYPE_CONFIG } from "@/types/facilities";
import { toast } from "sonner";

interface ChairCca {
	id: number;
	name: string;
}

interface ClaimDialogProps {
	slot: FacilitySlotWithClaims | null;
	chairCcas: ChairCca[];
	onClose: () => void;
	onSuccess: () => void;
}

function formatTime(time: string): string {
	const [h, m] = time.split(":");
	const hour = parseInt(h, 10);
	const ampm = hour >= 12 ? "PM" : "AM";
	const displayHour = hour % 12 || 12;
	return `${displayHour}:${m} ${ampm}`;
}

export function ClaimDialog({ slot, chairCcas, onClose, onSuccess }: ClaimDialogProps) {
	const [activity, setActivity] = useState("");
	const [selectedCcaId, setSelectedCcaId] = useState<number | null>(
		chairCcas.length === 1 ? chairCcas[0].id : null,
	);
	const [submitting, setSubmitting] = useState(false);

	if (!slot || chairCcas.length === 0) return null;

	const typeConfig = BOOKING_TYPE_CONFIG[slot.type];
	const selectedCca = chairCcas.find((c) => c.id === selectedCcaId);

	async function handleSubmit() {
		if (!selectedCcaId) {
			toast.error("Please select a CCA");
			return;
		}
		if (!activity.trim()) {
			toast.error("Please enter an activity name");
			return;
		}

		setSubmitting(true);
		try {
			const res = await fetch("/api/facilities/claims", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					facility_id: slot!.id,
					cca_id: selectedCcaId,
					activity: activity.trim(),
				}),
			});

			const json = await res.json();
			if (!res.ok) {
				toast.error(json.error ?? "Failed to submit claim");
				return;
			}

			if (json.data.status === "conflicted") {
				toast.warning("Slot claimed — but there's a conflict that needs resolution");
			} else {
				toast.success("Slot claimed successfully");
			}

			setActivity("");
			onSuccess();
			onClose();
		} catch {
			toast.error("Network error — please try again");
		} finally {
			setSubmitting(false);
		}
	}

	function handleOpenChange(isOpen: boolean) {
		if (!isOpen) {
			setActivity("");
			if (chairCcas.length > 1) setSelectedCcaId(null);
			onClose();
		}
	}

	return (
		<Dialog open={!!slot} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Claim Facility Slot</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<div className="rounded-lg bg-muted/50 p-3 text-sm">
						<div className="flex items-center gap-2 font-medium">
							<span
								className="h-2 w-2 rounded-full"
								style={{ backgroundColor: typeConfig.color }}
							/>
							{slot.venue} — {slot.sub_venue}
						</div>
						<div className="mt-1 text-muted-foreground">
							{slot.booked_date} · {formatTime(slot.time_from)} – {formatTime(slot.time_to)}
						</div>
					</div>

					<div className="space-y-2">
						<Label>Claiming as</Label>
						{chairCcas.length === 1 ? (
							<div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
								{chairCcas[0].name}
							</div>
						) : (
							<div className="grid gap-1.5">
								{chairCcas.map((cca) => (
									<button
										key={cca.id}
										type="button"
										onClick={() => setSelectedCcaId(cca.id)}
										className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
											selectedCcaId === cca.id
												? "border-primary bg-primary/5 font-medium text-primary"
												: "border-border hover:bg-accent"
										}`}
									>
										{cca.name}
									</button>
								))}
							</div>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="activity">Activity</Label>
						<Input
							id="activity"
							placeholder="e.g. Band Practice, Training Session"
							value={activity}
							onChange={(e) => setActivity(e.target.value)}
						/>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={onClose} disabled={submitting}>
						Cancel
					</Button>
					<Button onClick={handleSubmit} disabled={submitting || !selectedCcaId}>
						{submitting
							? "Submitting..."
							: selectedCca
								? `Claim for ${selectedCca.name}`
								: "Claim Slot"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
