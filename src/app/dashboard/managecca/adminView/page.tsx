'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Eye } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AppLayout } from '@/components/layout/app-layout';
import { AppLoading } from '@/components/layout/app-loading';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { CCAData } from '@/types/dashboard';
import { SelectionTable, SelectionTableColumn } from '@/components/table/selection-table';
import { CcaTypeBadge } from '@/components/badges/cca-type-badge';

type AdminCcaRow = CCAData & {
  search_text: string;
};

const adminColumns: SelectionTableColumn<AdminCcaRow>[] = [
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
    cell: (value) => <CcaTypeBadge value={String(value)} className="text-xs" />,
    enableSorting: true,
  },
  {
    accessorKey: 'search_text',
    header: 'Search',
    hidden: true,
  },
  {
    accessorKey: 'actions' as keyof AdminCcaRow,
    header: 'Actions',
    enableSorting: false,
    cell: (_, row) => (
      <div className="flex flex-col lg:flex-row gap-2 justify-start w-full">
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link href={`/dashboard/managecca/viewRankings/${encodeURIComponent(row.name)}?ccaId=${row.id}`}>
            <Eye className="h-4 w-4" />
            View Rankings
          </Link>
        </Button>
      </div>
    ),
  },
];

export default function AdminViewRankingsPage() {
  const { user } = useAuth();
  const [ccas, setCCAs] = useState<AdminCcaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    if (!user.is_jcrc && !user.is_admin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    fetch('/api/cca/rankings/all')
      .then(async (res) => {
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch rankings view data');
        }
        return res.json();
      })
      .then((data) => {
        const mappedRows: AdminCcaRow[] = ((data.data || []) as CCAData[]).map((row) => ({
          ...row,
          search_text: [row.name, row.cca_type].filter(Boolean).join(' '),
        }));
        setCCAs(mappedRows);
      })
      .catch((fetchError: Error) => {
        console.error('Error fetching admin view rankings list:', fetchError.message);
        toast.error(fetchError.message);
        setError('Failed to load rankings list');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user]);

  if (!user) return <AppLoading />;

  if (!user.is_jcrc && !user.is_admin) {
    return (
      <AppLayout>
        <div className="flex flex-col space-y-4 p-4">
          <h1 className="text-2xl font-bold">Admin View</h1>
          <Alert className="bg-yellow-50 border-yellow-200">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800">Restricted access</AlertTitle>
            <AlertDescription className="text-yellow-700">
              This page is restricted to JCRC members and administrators.
            </AlertDescription>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <LoadingSpinner message="Loading rankings view..." />
      </AppLayout>
    );
  }

  if (error && ccas.length === 0) {
    return (
      <AppLayout>
        <div className="flex flex-col space-y-4 p-4">
          <h1 className="text-2xl font-bold">Admin View</h1>
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
        <h1 className="text-2xl font-bold">Admin View</h1>
        {ccas.length === 0 ? (
          <Card className="bg-gray-50 border-2 border-dashed border-gray-300">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-lg text-gray-600 mb-2">📋 No CCAs found.</p>
              <p className="text-sm text-gray-500">
                No CCA records are available for ranking review at the moment.
              </p>
            </CardContent>
          </Card>
        ) : (
          <SelectionTable<AdminCcaRow>
            data={ccas}
            columns={adminColumns}
            searchColumn="search_text"
            searchPlaceholder="Search by CCA name or type..."
            pageSize={10}
            emptyMessage="No CCAs found"
          />
        )}
      </div>
    </AppLayout>
  );
}
