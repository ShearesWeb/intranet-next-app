'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { SimpleTable, SimpleTableColumn } from '@/components/table/simple-table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Card, CardContent } from '@/components/ui/card';
import { CCAData } from '@/types/dashboard';
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
    accessorKey: 'role',
    header: 'Role',
    cell: (value, row) => (
      <PositionTypeBadge
        value={String(value)}
        position_type={String(row.position_type || '')}
        className="text-xs"
      />
    ),
    enableSorting: true,
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
    accessorKey: 'points',
    header: 'Points',
    cell: (value) => (
      <div className="font-semibold text-center text-sm md:text-base">{String(value)}</div>
    ),
    enableSorting: true,
  },
];

export default function MyCCAs() {
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
    fetch('/api/user/getCCAs?includeAllAppointments=true')
      .then(async (res) => {
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to fetch user CCA data");
        }
        return res.json();
      })
      .then((data) => {
        setCCAs(data.data);
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
          <h1 className="text-2xl font-bold">My CCAs</h1>
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

  return (
    <AppLayout>
      <div className="flex flex-col space-y-4 p-4">
        <h1 className="text-2xl font-bold">My CCAs</h1>

        {ccas.length === 0 ? (
          <Card className="bg-gray-50 border-2 border-dashed border-gray-300">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-lg text-gray-600 mb-2">📋 No CCA appointments found.</p>
              <p className="text-sm text-gray-500">
                You have not been assigned to any CCAs yet. Check back later or contact your CCA chairs/ICs.
              </p>
            </CardContent>
          </Card>
        ) : (
          <SimpleTable<CCAData>
            data={ccas}
            columns={ccaTableColumns}
            pageSize={10}
            emptyMessage="No CCAs found"
          />
        )}
      </div>
    </AppLayout>
  );
}
