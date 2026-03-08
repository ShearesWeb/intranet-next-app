'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import { AUTHORIZED_CHAIR_ROLES, type ChairRole } from '@/lib/lead-auth-service';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { SimpleTable, SimpleTableColumn } from '@/components/table/simple-table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { CCAData } from '@/types/dashboard';
import { Users, BarChart3 } from 'lucide-react';

// Helper function to display CCA type with proper capitalization
const ccaTypeDisplay = (str: string) => {
  if (!str) return '';

  const typeMapping: Record<string, string> = {
    'committee': 'Committee',
    'sports': 'Sports',
    'culture': 'Culture',
    'jcrc': 'JCRC',
  };

  return typeMapping[str] || str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// Define table columns
const ccaTableColumns: SimpleTableColumn<CCAData>[] = [
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
    accessorKey: 'role',
    header: 'Role',
    cell: (value) => (
      <span className="inline-block px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-bold whitespace-nowrap">
        {value}
      </span>
    ),
    enableSorting: true,
  },
  {
    accessorKey: 'cca_type',
    header: 'Type',
    cell: (value) => (
      <span className="inline-block px-2 py-1 bg-green-50 text-green-700 rounded text-xs font-bold whitespace-nowrap">
        {ccaTypeDisplay(value)}
      </span>
    ),
    enableSorting: true,
  },
  {
    accessorKey: 'points',
    header: 'Points',
    cell: (value) => (
      <div className="font-semibold text-center text-sm md:text-base">{value}</div>
    ),
    enableSorting: true,
  },
];

export default function ManageCCA() {
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
    fetch('/api/user/getCCAs')
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
          <h1 className="text-2xl font-bold">Manage CCAs</h1>
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

  // Build dynamic columns based on user permissions
  const canManageMembers = (cca: CCAData) =>
    AUTHORIZED_CHAIR_ROLES.includes(cca.position_type as ChairRole);

  const canRankMembers = (cca: CCAData) =>
    canManageMembers(cca) || (cca.cca_type === 'committee' && cca.position_type === 'maincomm');

  const dynamicColumns: SimpleTableColumn<CCAData>[] = ccas.some(canRankMembers)
    ? [
      ...ccaTableColumns,
      {
        accessorKey: 'actions' as keyof CCAData,
        header: 'Actions',
        enableSorting: false,
        cell: (_, row) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const r = row as any;
          const allowManage = canManageMembers(r);
          const allowRank = canRankMembers(r);
          return (
          <div className="flex flex-col lg:flex-row gap-2 justify-start w-full">
            {allowManage || allowRank ? (
              <>
                {allowManage && (
                  <Button asChild size="sm" className="gap-2">
                    <Link href={`/dashboard/managecca/manageMembers/${encodeURIComponent(r.name)}?ccaId=${r.id}`}>
                      <Users className="h-4 w-4" />
                      Manage Members
                    </Link>
                  </Button>
                )}
                {allowRank && (
                  <Button asChild variant="outline" size="sm" className="gap-2">
                    <Link href={`/dashboard/managecca/${encodeURIComponent(r.name)}?ccaId=${r.id}`}>
                      <BarChart3 className="h-4 w-4" />
                      Rank Members
                    </Link>
                  </Button>
                )}
              </>
            ) : (
              <Button size="sm" variant="outline" disabled className="gap-2">
                <Users className="h-4 w-4" />
                No Actions Available
              </Button>
            )}
          </div>
        )},
      },
    ]
    : ccaTableColumns;

  return (
    <AppLayout>
      <div className="flex flex-col space-y-4 p-4">
        <h1 className="text-2xl font-bold">Manage CCAs</h1>

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
            columns={dynamicColumns}
            pageSize={10}
            emptyMessage="No CCAs found"
          />
        )}
      </div>
    </AppLayout>
  );
}
