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
import { FacilityTypeBadges } from "@/components/facilities/facility-type-badges";
import { FacilityType } from "@/types/facilities";
import { toast } from "sonner";

// REBOKS venues have a fixed scraped identity — not creatable in-app.
const ADDABLE_TYPES: FacilityType[] = ["sheares", "nus", "external"];

interface FacilityAddDialogProps {
	open: boolean;
	onClose: () => void;
	onSuccess: () => void;
}

export function FacilityAddDialog({ open, onClose, onSuccess }: FacilityAddDialogProps) {
	const [type, setType] = useState<FacilityType>("sheares");
	const [venue, setVenue] = useState("");
	const [subVenue, setSubVenue] = useState("");
	const [submitting, setSubmitting] = useState(false);

	async function submit() {
		if (!venue.trim() || !subVenue.trim()) {
			toast.error("Venue and sub-venue are required");
			return;
		}
		setSubmitting(true);
		try {
			const res = await fetch("/api/facilities/catalog", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ type, venue: venue.trim(), sub_venue: subVenue.trim() }),
			});
			const json = await res.json();
			if (!res.ok) {
				toast.error(json.error ?? "Failed to add facility");
				return;
			}
			toast.success("Facility added");
			setVenue("");
			setSubVenue("");
			onSuccess();
			onClose();
		} catch {
			toast.error("Network error");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add facility</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					<div className="space-y-1.5">
						<Label>Type</Label>
						<FacilityTypeBadges value={type} onChange={setType} types={ADDABLE_TYPES} />
						<p className="text-xs text-muted-foreground">
							Reboks venues are managed by the bot and can&apos;t be added here.
						</p>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="venue">Venue</Label>
						<Input
							id="venue"
							value={venue}
							onChange={(e) => setVenue(e.target.value)}
							placeholder="e.g. Sheares Hall"
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="subvenue">Sub-venue</Label>
						<Input
							id="subvenue"
							value={subVenue}
							onChange={(e) => setSubVenue(e.target.value)}
							placeholder="e.g. Multi-Purpose Hall"
						/>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button onClick={submit} isLoading={submitting}>
						Add
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
