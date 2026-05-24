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

interface ClaimDialogProps {
  slot: FacilitySlotWithClaims | null;
  ccaId: number;
  ccaName: string;
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

export function ClaimDialog({ slot, ccaId, ccaName, onClose, onSuccess }: ClaimDialogProps) {
  const [activity, setActivity] = useState("");
  const [recurrence, setRecurrence] = useState<"one-off" | "weekly">("one-off");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!slot) return null;

  const typeConfig = BOOKING_TYPE_CONFIG[slot.type];

  async function handleSubmit() {
    if (!activity.trim()) {
      toast.error("Please enter an activity name");
      return;
    }

    if (recurrence === "weekly" && !endDate) {
      toast.error("Please select an end date for weekly recurrence");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/facilities/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facility_id: slot!.id,
          cca_id: ccaId,
          activity: activity.trim(),
          recurrence_end_date: recurrence === "weekly" ? endDate : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to submit claim");
        return;
      }

      const claimCount = Array.isArray(json.data) ? json.data.length : 1;
      const hasConflicts = Array.isArray(json.data)
        ? json.data.some((c: { status: string }) => c.status === "conflicted")
        : json.data.status === "conflicted";

      if (hasConflicts) {
        toast.warning(
          `Claimed ${claimCount} slot${claimCount > 1 ? "s" : ""} — some have conflicts that need resolution`,
        );
      } else {
        toast.success(`Claimed ${claimCount} slot${claimCount > 1 ? "s" : ""} successfully`);
      }

      onSuccess();
      onClose();
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={!!slot} onOpenChange={() => onClose()}>
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

          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <span className="font-medium">Claiming as:</span>{" "}
            <span className="text-muted-foreground">{ccaName}</span>
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

          <div className="space-y-2">
            <Label>Recurrence</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={recurrence === "one-off" ? "default" : "outline"}
                onClick={() => setRecurrence("one-off")}
              >
                One-off
              </Button>
              <Button
                type="button"
                size="sm"
                variant={recurrence === "weekly" ? "default" : "outline"}
                onClick={() => setRecurrence("weekly")}
              >
                Weekly
              </Button>
            </div>
          </div>

          {recurrence === "weekly" && (
            <div className="space-y-2">
              <Label htmlFor="endDate">Repeat until</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                min={slot.booked_date}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting..." : "Claim Slot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
