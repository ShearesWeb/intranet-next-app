// C:\Ron\intranet-next-app\src\app\dashboard\mycca\page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { AUTHORIZED_CHAIR_ROLES, type ChairRole } from '@/lib/lead-auth-service';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { SimpleTable, SimpleTableColumn } from '@/components/table/simple-table';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertTitle } from '@/components/ui/alert';

interface CCAData {
  name: string;
  role: string;
  position_type: string
  cca_type: string;
  description: string;
  points: number;
}

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



export default function MyCCA() {
  const router = useRouter();
  const { user } = useAuth();
  const [points, setPoints] = useState(0);
  const [ccas, setCCAs] = useState<CCAData[]>([]);
  const [loadingCCAs, setLoadingCCAs] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.email) return;

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
  }, [user?.email]);

  const handleManageMembers = (cca: CCAData) => {
    router.push(`/dashboard/mycca/manageMembers/${encodeURIComponent(cca.name)}?ccaName=${encodeURIComponent(cca.name)}`);
  };

  if (loadingCCAs) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-full min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <Spinner className="w-8 h-8" />
            <p className="text-gray-600">Loading your CCA data...</p>
          </div>
        </div>
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

  // Build dynamic columns based on user permissions
  const dynamicColumns: SimpleTableColumn<CCAData>[] = ccas.some(cca =>
    AUTHORIZED_CHAIR_ROLES.includes(cca.position_type as ChairRole)
  )
    ? [
      ...ccaTableColumns,
      {
        accessorKey: 'actions' as keyof CCAData,
        header: 'Actions',
        enableSorting: false,
        cell: (_, row) =>
          AUTHORIZED_CHAIR_ROLES.includes(row.position_type as ChairRole) && (
            <div className="text-center">
              <Button
                size="sm"
                onClick={() => handleManageMembers(row)}
                className="bg-blue-500 text-white hover:bg-blue-400 px-4 py-2 shadow-md font-bold cursor-pointer"
              >
                View
              </Button>
            </div>
          ),
      },
    ]
    : ccaTableColumns;

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
            columns={dynamicColumns}
            pageSize={10}
            emptyMessage="No CCAs found"
          />
        )}

        <Alert className="bg-blue-500/10 dark:bg-blue-600/20 text-blue-500 border-none">
          <AlertTitle><strong>Total Points:</strong> {points || 0}</AlertTitle>
        </Alert>
      </div>
    </AppLayout>
  );
}
