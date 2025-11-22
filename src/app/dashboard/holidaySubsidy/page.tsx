'use client';

import React, { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { SimpleTable, type SimpleTableColumn } from '@/components/table/simple-table';
import { CCAData } from '@/types/dashboard';
import { ArrowRight, Info } from 'lucide-react';
import { CcaTypeBadge } from '@/components/badges/cca-type-badge';
import { Spinner } from '@/components/ui/spinner';
import { AUTHORIZED_CHAIR_ROLES } from '@/lib/lead-auth-service';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

type SubsidyRow = CCAData;

const columns: SimpleTableColumn<SubsidyRow>[] = [
  {
    accessorKey: 'name',
    header: 'CCA',
    cell: (value, row) => (
      <div className="flex flex-col gap-2 pr-4">
        <strong className="font-semibold text-sm md:text-base">{value}</strong>
        {row.description && (
          <div className="text-xs md:text-sm text-gray-600 break-words whitespace-normal text-justify leading-relaxed line-clamp-5">
            {row.description}
          </div>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'cca_type',
    header: 'Type',
    cell: (value) => <CcaTypeBadge value={String(value)} />,
  },
  {
    accessorKey: 'actions' as keyof SubsidyRow,
    header: 'Actions',
    enableSorting: false,
    cell: (_, row) => (
      <div className="flex flex-col sm:flex-row sm:items-center justify-start gap-2">
        <Link href={`/dashboard/holidaySubsidy/declaration/${encodeURIComponent(row.name)}`}>
          <Button size="sm" variant="outline" className="gap-2 px-3 py-2">
            Subsidy Declaration
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link href={`/dashboard/holidaySubsidy/weekly`}>
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
    if (!user?.email) {
      setLoading(false);
      setSubsidyData([]);
      return;
    }

    const fetchCCAData = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/user/getCCAs');
        if (!res.ok) {
          throw new Error('Failed to fetch CCA data');
        }

        const data = await res.json();
        const chairCCAs = (data.data || []).filter((cca: CCAData) =>
          AUTHORIZED_CHAIR_ROLES.includes((cca.position_type || '').toLowerCase() as ChairRole)
        );
        setSubsidyData(chairCCAs);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load CCAs';
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    fetchCCAData();
  }, [user?.email]);

  const hasChairAccess = subsidyData.length > 0;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center">
          <div className="flex flex-col items-center gap-3">
            <Spinner className="w-8 h-8" />
            <p className="text-gray-600">Loading your CCAs...</p>
          </div>
        </div>
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
            tableClassName="[&_th]:px-5 [&_td]:px-5"
          />
        </div>
      </div>
    </AppLayout>
  );
}
