'use client';

import React from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { SimpleTable, type SimpleTableColumn } from '@/components/table/simple-table';
import { CCAData } from '@/types/dashboard';
import { ArrowRight, Info } from 'lucide-react';
import { CcaTypeBadge } from '@/components/badges/type-badges';

type SubsidyRow = CCAData;

const mockSubsidyData: SubsidyRow[] = [
  {
    name: 'Swim Team',
    role: 'Member',
    position_type: 'member',
    cca_type: 'sports',
    description: 'Weekly pool training sessions and inter-hall meets.',
    points: 12,
  },
  {
    name: 'Drama',
    role: 'Crew',
    position_type: 'subcomm',
    cca_type: 'culture',
    description: 'Stage setup, blocking rehearsals, and lighting support.',
    points: 9,
  },
  {
    name: 'Block Committee',
    role: 'Logistics',
    position_type: 'blockcomm',
    cca_type: 'committee',
    description: 'Block-level programming, weekly meetings, and holiday ops.',
    points: 7,
  },
];

const columns: SimpleTableColumn<SubsidyRow>[] = [
  {
    accessorKey: 'name',
    header: 'CCA',
    cell: (value, row) => (
      <div className="flex flex-col gap-1 pr-4">
        <strong className="font-semibold text-sm md:text-base leading-tight">{value}</strong>
        {row.description && (
          <div className="text-xs md:text-sm text-muted-foreground line-clamp-2">
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
            data={mockSubsidyData}
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
