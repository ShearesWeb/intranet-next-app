"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ConflictCard } from "@/components/facilities/conflict-card";
import { ConflictView } from "@/types/facilities";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

export default function ConflictsPage() {
  const { user } = useAuth();
  const [conflicts, setConflicts] = useState<ConflictView[]>([]);
  const [loading, setLoading] = useState(true);

  const userCcaIds = useMemo(() => {
    if (!user) return [];
    return user.appointments
      .filter((a) => a.position_type === "lead" || a.position_type === "vice")
      .map((a) => a.cca_id);
  }, [user]);

  const fetchConflicts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/facilities/conflicts");
      if (res.ok) {
        const json = await res.json();
        setConflicts(json.data ?? []);
      }
    } catch {
      toast.error("Failed to load conflicts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConflicts();
  }, [fetchConflicts]);

  const sorted = [...conflicts].sort(
    (a, b) => a.days_until_booking - b.days_until_booking,
  );

  return (
    <>
      <PageHeader
        title="Facility Conflicts"
        description="Active conflicts involving your CCA — resolve by yielding or contacting the other party"
      />

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No active conflicts"
          description="When multiple CCAs claim the same slot, conflicts appear here."
        />
      ) : (
        <div className="space-y-3">
          {sorted.map((conflict) => (
            <ConflictCard
              key={conflict.facility.id}
              conflict={conflict}
              userCcaIds={userCcaIds}
              onYield={fetchConflicts}
            />
          ))}
        </div>
      )}
    </>
  );
}
