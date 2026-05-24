"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ConflictCard } from "@/components/facilities/conflict-card";
import { OverrideDialog } from "@/components/facilities/override-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConflictView } from "@/types/facilities";
import { toast } from "sonner";
import { Shield, AlertTriangle } from "lucide-react";

export default function FacilitiesAdminPage() {
  const { user } = useAuth();
  const [conflicts, setConflicts] = useState<ConflictView[]>([]);
  const [loading, setLoading] = useState(true);
  const [overrideTarget, setOverrideTarget] = useState<ConflictView | null>(null);

  const fetchConflicts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/facilities/admin/conflicts");
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

  if (user && !user.is_jcrc && !user.is_admin) {
    return (
      <>
        <PageHeader title="Facilities Admin" />
        <EmptyState
          icon={Shield}
          title="Access Denied"
          description="Only JCRC members and admins can access this page."
        />
      </>
    );
  }

  const escalated = conflicts
    .filter((c) => c.escalated)
    .sort((a, b) => a.days_until_booking - b.days_until_booking);

  const allActive = conflicts
    .sort((a, b) => a.days_until_booking - b.days_until_booking);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function handleOverride(facilityId: number, _winningCcaId: number) {
    const conflict = conflicts.find((c) => c.facility.id === facilityId);
    if (conflict) setOverrideTarget(conflict);
  }

  return (
    <>
      <PageHeader
        title="Facilities Admin"
        description="Manage escalated conflicts and override contested slot assignments"
      />

      <Tabs defaultValue="escalated">
        <TabsList>
          <TabsTrigger value="escalated">
            Escalated ({escalated.length})
            {escalated.length > 0 && (
              <AlertTriangle className="ml-1 h-3 w-3 text-[#f87171]" />
            )}
          </TabsTrigger>
          <TabsTrigger value="all">All Conflicts ({allActive.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="escalated">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>
          ) : escalated.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="No escalated conflicts"
              description="Conflicts auto-escalate 3 days before the booking date."
            />
          ) : (
            <div className="mt-3 space-y-3">
              {escalated.map((conflict) => (
                <ConflictCard
                  key={conflict.facility.id}
                  conflict={conflict}
                  userCcaIds={[]}
                  onYield={fetchConflicts}
                  showOverride
                  onOverride={handleOverride}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>
          ) : allActive.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="No active conflicts"
              description="All slot claims are uncontested."
            />
          ) : (
            <div className="mt-3 space-y-3">
              {allActive.map((conflict) => (
                <ConflictCard
                  key={conflict.facility.id}
                  conflict={conflict}
                  userCcaIds={[]}
                  onYield={fetchConflicts}
                  showOverride
                  onOverride={handleOverride}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <OverrideDialog
        conflict={overrideTarget}
        onClose={() => setOverrideTarget(null)}
        onSuccess={fetchConflicts}
      />
    </>
  );
}
