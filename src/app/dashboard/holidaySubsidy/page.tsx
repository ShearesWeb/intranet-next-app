'use client';

import React from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { SimpleTable, type SimpleTableColumn } from '@/components/table/simple-table';
import { Badge } from '@/components/ui/badge';
import { CCAData } from '@/types/dashboard';

type SubsidyRow = CCAData & {
    hours_pending: number;
    subsidy_status: 'Eligible' | 'Submitted' | 'Not started';
};

const mockSubsidyData: SubsidyRow[] = [
    {
        name: 'Swim Team',
        role: 'Member',
        position_type: 'member',
        cca_type: 'sports',
        description: 'Weekly pool training sessions and inter-hall meets.',
        points: 12,
        hours_pending: 4,
        subsidy_status: 'Eligible',
    },
    {
        name: 'Drama',
        role: 'Crew',
        position_type: 'subcomm',
        cca_type: 'culture',
        description: 'Stage setup, blocking rehearsals, and lighting support.',
        points: 9,
        hours_pending: 6,
        subsidy_status: 'Submitted',
    },
    {
        name: 'Block Committee',
        role: 'Logistics',
        position_type: 'blockcomm',
        cca_type: 'committee',
        description: 'Block level programming and weekly meetings.',
        points: 7,
        hours_pending: 2,
        subsidy_status: 'Not started',
    },
];

const columns: SimpleTableColumn<SubsidyRow>[] = [
    {
        accessorKey: 'name',
        header: 'CCA',
        cell: (value, row) => (
            <div className="flex flex-col gap-1 pr-4">
                <strong className="font-semibold text-sm md:text-base">{value}</strong>
                {row.description && (
                    <div className="text-xs md:text-sm text-muted-foreground line-clamp-2">
                        {row.description}
                    </div>
                )}
            </div>
        ),
    },
    {
        accessorKey: 'role',
        header: 'Role',
        cell: (value) => (
            <span className="inline-block px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-semibold whitespace-nowrap">
                {value}
            </span>
        ),
    },
    {
        accessorKey: 'cca_type',
        header: 'Type',
        cell: (value) => (
            <Badge variant="secondary" className="capitalize">
                {String(value)}
            </Badge>
        ),
    },
    {
        accessorKey: 'hours_pending',
        header: 'Pending Hours',
        cell: (value) => <div className="font-semibold">{value} hrs</div>,
    },
    {
        accessorKey: 'subsidy_status',
        header: 'Status',
        cell: (value) => {
            const variant =
                value === 'Submitted' ? 'secondary' : value === 'Eligible' ? 'default' : 'outline';
            return (
                <Badge variant={variant as any} className="whitespace-nowrap">
                    {value}
                </Badge>
            );
        },
    },
    {
        accessorKey: 'actions' as keyof SubsidyRow,
        header: 'Actions',
        enableSorting: false,
        cell: (_, row) => (
            <div className="flex justify-end">
                <Link href={`/dashboard/holidaySubsidy/declaration?cca=${encodeURIComponent(row.name)}`}>
                    <Button size="sm" className="bg-blue-500 text-white hover:bg-blue-400 px-4 py-2 shadow-sm">
                        Open
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
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold">Holiday Subsidy</h1>
                    <p className="text-muted-foreground text-sm">
                        View your CCAs and jump into subsidy declarations.
                    </p>
                </div>

                <Card className="border shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg">Your CCAs</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                        <SimpleTable
                            data={mockSubsidyData}
                            columns={columns}
                            searchColumn="name"
                            searchPlaceholder="Search CCA..."
                            pageSize={5}
                            emptyMessage="No CCAs found."
                        />
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
