'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { SimpleTable, SimpleTableColumn } from '@/components/table/simple-table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { CCAData } from '@/types/dashboard';
import { Users, BarChart3, ArrowLeft } from 'lucide-react';
import { PositionTypeBadge } from '@/components/badges/position-type-badge';
import { CcaTypeBadge } from '@/components/badges/cca-type-badge';

const ccaTableColumns: SimpleTableColumn<CCAData>[] = [
  {
    accessorKey: 'name',
    header: 'CCA',
    cell: (value, row) => (
      <div className="flex flex-col gap-2 pr-4">
        <strong className="font-semibold text-sm md:text-base">{String(value)}</strong>
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
    cell: (value) => (
      <CcaTypeBadge value={String(value)} className="text-xs" />
    ),
    enableSorting: true,
  },
  {
    accessorKey: 'positions',
    header: 'Managed Positions',
    cell: (_, row) => {
      const positions = row.positions ?? [];

      if (positions.length === 0) {
        return (
          <div className="text-xs text-muted-foreground">
            No managed positions
          </div>
        );
      }

      return (
        <div className="flex min-w-[12rem] flex-col items-start gap-2">
          {positions.map((position) => (
            <PositionTypeBadge
              key={position.position_id}
              value={position.position_name}
              position_type={position.position_type}
              className="text-xs"
            />
          ))}
        </div>
      );
    },
    enableSorting: false,
  },
];

export default function CCAAdmin() {
  const { user } = useAuth();
  const [ccas, setCCAs] = useState<CCAData[]>([]);
  const [loadingCCAs, setLoadingCCAs] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setCCAs([]);
      setLoadingCCAs(false);
      return;
    }

    if (!user.appointments?.length) {
      setCCAs([]);
      setLoadingCCAs(false);
      return;
    }

    setLoadingCCAs(true);
    setError(null);
    fetch('/api/user/getManagedCCAs')
      .then(async (res) => {
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to fetch managed CCA data");
        }
        return res.json();
      })
      .then((data) => {
        setCCAs(data.data as CCAData[]);
      })
      .catch((error) => {
        console.error("Error fetching CCAs:", error.message);
        toast.error(error.message);
        setError("Failed to load CCAs");
      })
      .finally(() => {
        setLoadingCCAs(false);
      });
  }, [user]);

  if (loadingCCAs) {
    return (
      <AppLayout>
        <LoadingSpinner message="Loading your CCA data..." />
      </AppLayout>
    );
  }

  if (error && ccas.length === 0) {
    return (
      <AppLayout>
        <div className="flex flex-col space-y-4 p-4">
          <h1 className="text-2xl font-bold">CCA Admin</h1>
          <Card className="bg-red-50 border-red-200">
            <CardContent className="flex flex-col items-center p-6 gap-4">
              <p className="text-red-700 font-medium text-center">⚠️ {error}</p>
              <Button
                onClick={() => window.location.reload()}
                className="bg-blue-500 text-white hover:bg-blue-400 px-6 py-4 shadow-md font-bold cursor-pointer"
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const dynamicColumns: SimpleTableColumn<CCAData>[] = [
    ...ccaTableColumns,
    {
      accessorKey: 'actions' as keyof CCAData,
      header: 'Actions',
      enableSorting: false,
      cell: (_, row) => {
        const allowManage = Boolean(row.can_manage_members);
        const allowRank = Boolean(row.can_rank_members);

        return (
          <div className="flex flex-col lg:flex-row gap-2 justify-start w-full">
            {allowManage && (
              <Button asChild size="sm" className="gap-2">
                <Link href={`/dashboard/mycca/admin/manageMembers/${encodeURIComponent(row.name)}?ccaId=${row.id}`}>
                  <Users className="h-4 w-4" />
                  Manage Members
                </Link>
              </Button>
            )}
            {allowRank && (
              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link href={`/dashboard/mycca/admin/rankMembers/${encodeURIComponent(row.name)}?ccaId=${row.id}`}>
                  <BarChart3 className="h-4 w-4" />
                  Rank Members
                </Link>
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col space-y-4 p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-bold">CCA Admin</h1>
          <Link href="/dashboard/mycca">
            <Button variant="outline" size="lg" className="px-6 py-4">
              <ArrowLeft className="h-4 w-4" /> Back to My CCAs
            </Button>
          </Link>
        </div>

        {ccas.length === 0 ? (
          <Card className="bg-gray-50 border-2 border-dashed border-gray-300">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-lg text-gray-600 mb-2">📋 No manageable CCAs found.</p>
              <p className="text-sm text-gray-500">
                You do not have admin permissions for any CCAs.
              </p>
            </CardContent>
          </Card>
        ) : (
          <SimpleTable<CCAData>
            data={ccas}
            columns={dynamicColumns}
            searchColumn="name"
            searchPlaceholder="Search CCA..."
            pageSize={10}
            emptyMessage="No CCAs found"
          />
        )}
      </div>
    </AppLayout>
  );
}
