"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CLAIM_STATUS_CONFIG } from "@/types/facilities";
import { toast } from "sonner";
import { Calendar, AlertTriangle } from "lucide-react";

interface ClaimRow {
  id: number;
  facility_id: number;
  cca_id: number;
  cca_name: string;
  activity: string;
  status: string;
  recurrence_group: string | null;
  claimed_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  facility: {
    booked_date: string;
    venue: string;
    sub_venue: string;
    time_from: string;
    time_to: string;
    type: string;
  };
}

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${ampm}`;
}

export default function MyBookingsPage() {
  const { user } = useAuth();
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);

  const chairCca = useMemo(() => {
    if (!user) return null;
    const appt = user.appointments.find(
      (a) => a.position_type === "lead" || a.position_type === "vice",
    );
    return appt ? { id: appt.cca_id, name: appt.cca_name } : null;
  }, [user]);

  const fetchClaims = useCallback(async () => {
    if (!chairCca) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/facilities/claims?ccaId=${chairCca.id}`);
      if (res.ok) {
        const json = await res.json();
        setClaims(json.data ?? []);
      }
    } catch {
      toast.error("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }, [chairCca]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  const today = new Date().toISOString().split("T")[0];

  const upcoming = claims.filter(
    (c) => c.status === "approved" && c.facility?.booked_date >= today,
  );
  const conflicted = claims.filter((c) => c.status === "conflicted");
  const past = claims.filter(
    (c) => c.status === "approved" && c.facility?.booked_date < today,
  );

  async function handleAction(claimId: number, status: "yielded" | "cancelled") {
    try {
      const res = await fetch(`/api/facilities/claims/${claimId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error ?? "Failed to update");
        return;
      }
      toast.success(status === "yielded" ? "Yielded slot" : "Cancelled booking");
      fetchClaims();
    } catch {
      toast.error("Network error");
    }
  }

  if (!chairCca) {
    return (
      <AppLayout>
        <PageHeader title="My CCA Bookings" />
        <EmptyState
          icon={Calendar}
          title="Not a CCA Chair"
          description="Only CCA chairs can view and manage bookings."
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="My CCA Bookings"
        description={`Manage facility bookings for ${chairCca.name}`}
      />

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">
            Upcoming ({upcoming.length})
          </TabsTrigger>
          <TabsTrigger value="conflicted">
            Conflicted ({conflicted.length})
            {conflicted.length > 0 && (
              <AlertTriangle className="ml-1 h-3 w-3 text-[#f87171]" />
            )}
          </TabsTrigger>
          <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          <ClaimsList
            claims={upcoming}
            loading={loading}
            emptyMessage="No upcoming bookings"
            actions={(claim) => (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAction(claim.id, "cancelled")}
              >
                Cancel
              </Button>
            )}
          />
        </TabsContent>

        <TabsContent value="conflicted">
          <ClaimsList
            claims={conflicted}
            loading={loading}
            emptyMessage="No active conflicts"
            actions={(claim) => (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleAction(claim.id, "yielded")}
              >
                Yield
              </Button>
            )}
          />
        </TabsContent>

        <TabsContent value="past">
          <ClaimsList
            claims={past}
            loading={loading}
            emptyMessage="No past bookings"
          />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

function ClaimsList({
  claims,
  loading,
  emptyMessage,
  actions,
}: {
  claims: ClaimRow[];
  loading: boolean;
  emptyMessage: string;
  actions?: (claim: ClaimRow) => React.ReactNode;
}) {
  if (loading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>;
  }

  if (claims.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title={emptyMessage}
        description="Bookings will appear here when you claim facility slots."
      />
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {claims.map((claim) => (
        <div
          key={claim.id}
          className="flex items-center justify-between rounded-lg border p-3"
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {claim.facility?.venue} — {claim.facility?.sub_venue}
              </span>
              <Badge
                variant="outline"
                style={{
                  borderColor: CLAIM_STATUS_CONFIG[claim.status as keyof typeof CLAIM_STATUS_CONFIG]?.color,
                  color: CLAIM_STATUS_CONFIG[claim.status as keyof typeof CLAIM_STATUS_CONFIG]?.color,
                }}
              >
                {CLAIM_STATUS_CONFIG[claim.status as keyof typeof CLAIM_STATUS_CONFIG]?.label ?? claim.status}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {claim.facility?.booked_date} ·{" "}
              {claim.facility ? `${formatTime(claim.facility.time_from)} – ${formatTime(claim.facility.time_to)}` : ""}{" "}
              · {claim.activity}
            </p>
          </div>
          {actions && <div>{actions(claim)}</div>}
        </div>
      ))}
    </div>
  );
}
