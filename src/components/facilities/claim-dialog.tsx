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
import { Label } from "@/components/ui/label";
import { SlotWithContext, FACILITY_TYPE_CONFIG, formatHourRange } from "@/types/facilities";
import { toast } from "sonner";

interface ChairCca {
	id: number;
	name: string;
}

interface ClaimDialogProps {
	booking: SlotWithContext | null;
	chairCcas: ChairCca[];
	onClose: () => void;
	onSuccess: () => void;
}

export function ClaimDialog({ booking, chairCcas, onClose, onSuccess }: ClaimDialogProps) {
	const [manuallySelectedCcaId, setManuallySelectedCcaId] = useState<number | null>(null);
	const [submitting, setSubmitting] = useState(false);

	if (!booking || chairCcas.length === 0) return null;

	// Auth data can arrive after this component's first render. Deriving the only
	// available CCA keeps it selected regardless of that loading timing.
	const selectedCcaId = chairCcas.length === 1 ? chairCcas[0].id : manuallySelectedCcaId;
	const typeConfig = FACILITY_TYPE_CONFIG[booking.type];
	const selectedCca = chairCcas.find((c) => c.id === selectedCcaId);

	async function handleSubmit() {
		if (selectedCcaId === null) {
			toast.error("Please select a CCA");
			return;
		}

		setSubmitting(true);
		try {
			const res = await fetch("/api/facilities/claims", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					facility_id: booking!.facility_id,
					date: booking!.date,
					hour: booking!.hour,
					cca_id: selectedCcaId,
				}),
			});

			const json = await res.json();
			if (!res.ok) {
				toast.error(json.error ?? "Failed to submit claim");
				return;
			}

			if (booking!.status !== "available") {
				toast.warning("Claim submitted — this slot is contested; JCRC will pick the winner");
			} else {
				toast.success("Claim submitted — pending JCRC approval");
			}

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
			setManuallySelectedCcaId(null);
			onClose();
		}
	}

	return (
		<Dialog open={!!booking} onOpenChange={handleOpenChange}>
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
							{booking.venue} — {booking.sub_venue}
						</div>
						<div className="mt-1 text-muted-foreground">
							{booking.date} · {formatHourRange(booking.hour)}
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
										onClick={() => setManuallySelectedCcaId(cca.id)}
										className={`rounded-md border px-3 py-2 text-left text-sm transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
											selectedCcaId === cca.id
												? "border-primary bg-primary/5 font-medium text-primary ring-1 ring-primary/40 shadow-sm"
												: "border-border hover:bg-accent"
										}`}
									>
										{cca.name}
									</button>
								))}
							</div>
						)}
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={onClose} disabled={submitting}>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						isLoading={submitting}
						loadingText="Submitting…"
						disabled={selectedCcaId === null}
					>
						{selectedCca ? `Claim for ${selectedCca.name}` : "Claim Slot"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
