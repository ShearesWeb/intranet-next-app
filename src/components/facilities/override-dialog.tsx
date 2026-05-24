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
import { Textarea } from "@/components/ui/textarea";
import { ConflictView } from "@/types/facilities";
import { toast } from "sonner";

interface OverrideDialogProps {
  conflict: ConflictView | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function OverrideDialog({ conflict, onClose, onSuccess }: OverrideDialogProps) {
  const [selectedCcaId, setSelectedCcaId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!conflict) return null;

  const activeClaims = conflict.claimants.filter(
    (c) => c.claim.status === "conflicted",
  );

  async function handleOverride() {
    if (!selectedCcaId) {
      toast.error("Please select a CCA to assign the slot to");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/facilities/admin/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facility_id: conflict!.facility.id,
          winning_cca_id: selectedCcaId,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error ?? "Failed to override");
        return;
      }

      toast.success("Slot assigned successfully");
      onSuccess();
      onClose();
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={!!conflict} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Contested Slot</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p className="font-medium">
              {conflict.facility.venue} — {conflict.facility.sub_venue}
            </p>
            <p className="text-muted-foreground">
              {conflict.facility.booked_date}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Assign to</Label>
            <div className="space-y-1.5">
              {activeClaims.map((c) => (
                <button
                  key={c.claim.id}
                  onClick={() => setSelectedCcaId(c.claim.cca_id)}
                  className={`w-full rounded-md border p-3 text-left text-sm transition-colors ${
                    selectedCcaId === c.claim.cca_id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent/50"
                  }`}
                >
                  <span className="font-medium">{c.cca_name}</span>
                  <span className="ml-2 text-muted-foreground">— {c.claim.activity}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              placeholder="Reason for this decision..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleOverride} disabled={submitting || !selectedCcaId}>
            {submitting ? "Assigning..." : "Assign Slot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
