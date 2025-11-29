'use client';

import React, { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { SimpleTable, type SimpleTableColumn } from '@/components/table/simple-table';
import { ArrowRight, Info } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { AUTHORIZED_CHAIR_ROLES, ChairRole } from '@/lib/lead-auth-service';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { PositionTypeBadge } from '@/components/badges/position-type-badge';

type SubsidyRow = {
  name: string;
  position_name: string;
  position_type: string;
};

const columns: SimpleTableColumn<SubsidyRow>[] = [
  {
    accessorKey: 'name',
    header: 'CCA',
    cell: (value) => (
      <div className="font-semibold">{value}</div>
    ),
  },
  {
    accessorKey: 'position_name',
    header: 'Your Position',
    enableSorting: false,
    cell: (_, row) => (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-foreground">{row.position_name}</span>
        <PositionTypeBadge value={row.position_type} className="capitalize" />
      </div>
    ),
  },
  {
    accessorKey: 'actions' as keyof SubsidyRow,
    header: 'Actions',
    enableSorting: false,
    cell: (_, row) => (
      <div className="flex flex-col sm:flex-row sm:items-center justify-end sm:justify-start gap-2 w-full sm:w-auto">
        <Link href={`/dashboard/holidaySubsidy/declaration/${encodeURIComponent(row.name)}`}>
          <Button size="sm" variant="outline" className="gap-2 px-3 py-2">
            Subsidy Declaration
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link href={`/dashboard/holidaySubsidy/weekly/${encodeURIComponent(row.name)}`}>
          <Button size="sm" className="gap-2 px-3 py-2">
            Weekly Commitment Declaration
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    ),
  },
];

export default function HolidaySubsidyLanding() {
  const { user } = useAuth();
  const [subsidyData, setSubsidyData] = useState<SubsidyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setSubsidyData([]);
      return;
    }

    if (!user.appointments?.length) {
      setLoading(false);
      setSubsidyData([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const chairCCAs = user.appointments
        .filter((appointment) =>
          AUTHORIZED_CHAIR_ROLES.includes((appointment.position_type || '').toLowerCase() as ChairRole)
        )
        .map((appointment) => ({
          name: appointment.cca_name,
          position_name: appointment.position_name,
          position_type: appointment.position_type,
        }));
      setSubsidyData(chairCCAs);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load CCAs';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const hasChairAccess = subsidyData.length > 0;

  if (loading) {
    return (
      <AppLayout>
        <LoadingSpinner message="Loading your CCAs..." />
      </AppLayout>
    );
  }

  if ((error && subsidyData.length === 0) || (!hasChairAccess && !error)) {
    return (
      <AppLayout>
        <div className="flex flex-col space-y-4 p-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold">Holiday Subsidy</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Review your CCAs, see pending hours, and jump straight into the subsidy declaration page for each role.
            </p>
          </div>

          <Card className="bg-muted/40">
            <CardContent className="flex flex-col gap-3 p-6">
              <div className="text-lg font-semibold">You are not a chair/vice for any CCA.</div>
              <p className="text-sm text-muted-foreground">
                Only CCA leads and vice leads can submit holiday subsidy declarations. If you believe this is a mistake,
                please contact your CCA administrator.
              </p>
              {error && (
                <div className="text-sm text-destructive">
                  {error}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col space-y-4 p-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">Holiday Subsidy</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Review your CCAs, see pending hours, and jump straight into the subsidy declaration page for each role.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="space-y-1">
              <div className="text-lg font-semibold">Your CCAs</div>
              <div className="text-muted-foreground text-sm flex items-center gap-2">
                <Info className="h-4 w-4" />
                Chairs/ICs can submit holiday subsidy declarations per CCA.
              </div>
            </div>
            <Link href="/dashboard/holidaySubsidy/guide" className="self-start sm:self-center">
              <Button variant="default" size="sm">View Guide</Button>
            </Link>
          </div>
          <SimpleTable
            data={subsidyData}
            columns={columns}
            searchColumn="name"
            searchPlaceholder="Search CCA..."
            pageSize={5}
            emptyMessage="No CCAs found."
            tableContainerClassName="rounded-lg border bg-card/40 overflow-hidden"
            tableClassName="min-w-full [&_th]:px-5 [&_td]:px-5"
          />
        </div>
      </div>
    </AppLayout>
  );
}
