// src/app/dashboard/rank/page.tsx
// Page for users to rank CCA positions
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePhaseInfo } from '@/hooks/usePhaseInfo';
import toast from 'react-hot-toast';
import { AppLayout } from '@/components/layout/app-layout';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { SelectionTable, SelectionTableColumn } from '@/components/table/selection-table';
import { OrderingTable, OrderingTableColumn } from '@/components/table/ordering-table';
import { RankablePosition } from '@/types/dashboard';
import { PositionTypeBadge } from '@/components/badges/position-type-badge';

export default function RankCCA() {
  const { user } = useAuth();
  const { phaseInfo, loading: phaseLoading } = usePhaseInfo();
  const [allPositions, setAllPositions] = useState<RankablePosition[]>([]);
  const [selectedPositions, setSelectedPositions] = useState<RankablePosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState<'selection' | 'ranking'>('selection');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [initialSelectedIds, setInitialSelectedIds] = useState<Set<number>>(new Set());
  const [initialRankingOrder, setInitialRankingOrder] = useState<number[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const detectChanges = useCallback(() => {
    const selectedIdsChanged =
      selectedIds.size !== initialSelectedIds.size ||
      [...selectedIds].some((id) => !initialSelectedIds.has(id));
    const currentOrder = selectedPositions.map((p) => p.id);
    const rankingOrderChanged =
      JSON.stringify(currentOrder) !== JSON.stringify(initialRankingOrder);
    const changes = selectedIdsChanged || rankingOrderChanged;
    setHasChanges(changes);
    return changes;
  }, [selectedIds, initialSelectedIds, selectedPositions, initialRankingOrder]);

  useEffect(() => {
    detectChanges();
  }, [selectedIds, selectedPositions, detectChanges]);

  useEffect(() => {
    if (!user?.email) return;

    const fetchRankablePositions = async () => {
      try {
        const response = await fetch(`/api/user/getRankablePositions/${user.email}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch rankable positions');
        }
        const data = await response.json();
        setAllPositions(data.positions || []);
        const preSelected = new Set<number>(
          data.positions
            ?.filter((p: RankablePosition) => p.is_selected)
            .map((p: RankablePosition) => p.id) || []
        );
        setSelectedIds(preSelected);
        setInitialSelectedIds(new Set(preSelected));

        if (preSelected.size > 0) {
          const selected = data.positions?.filter((p: RankablePosition) =>
            preSelected.has(p.id)
          );
          selected.sort(
            (a: RankablePosition, b: RankablePosition) =>
              (a.user_ranking || 999) - (b.user_ranking || 999)
          );
          setSelectedPositions(selected);
          setInitialRankingOrder(selected.map((p: RankablePosition) => p.id));
          setCurrentStep('ranking');
        } else {
          setInitialRankingOrder([]);
        }

        setHasChanges(false);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error occurred';
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchRankablePositions();
  }, [user?.email]);

  const togglePositionSelection = useCallback((positionId: number) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(positionId)) {
        newSet.delete(positionId);
      } else {
        newSet.add(positionId);
      }
      return newSet;
    });
  }, []);

  const proceedToRanking = useCallback(() => {
    const selected = allPositions.filter((p) => selectedIds.has(p.id));
    selected.sort((a, b) => a.name.localeCompare(b.name));
    setSelectedPositions(selected);
    setCurrentStep('ranking');
  }, [allPositions, selectedIds]);

  const backToSelection = useCallback(() => {
    setCurrentStep('selection');
  }, []);

  const handleReorder = useCallback((newData: RankablePosition[]) => {
    setSelectedPositions(newData);
  }, []);

  const saveRankings = async () => {
    if (!user?.email) return;
    setIsSaving(true);
    try {
      const rankings = selectedPositions.map((p, i) => ({
        position_id: p.id,
        ranking: i + 1,
      }));
      const res = await fetch('/api/user/saveRankings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, rankings }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save rankings');
      }
      toast.success('Rankings saved successfully!');
      setInitialSelectedIds(new Set(selectedIds));
      setInitialRankingOrder(selectedPositions.map((p) => p.id));
      setHasChanges(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSaving(false);
    }
  };

  // Define columns for selection table
  const selectionColumns: SelectionTableColumn<RankablePosition>[] = [
    {
      accessorKey: 'name',
      header: 'Position Name',
      cell: (value) => <div className="font-medium">{value}</div>,
    },
    {
      accessorKey: 'cca_name',
      header: 'CCA',
    },
    {
      accessorKey: 'position_type',
      header: 'Type',
      cell: (value) => <PositionTypeBadge value={String(value)} />,
    },
    {
      accessorKey: 'available_capacity',
      header: 'Availability',
      cell: (value) => {
        const available = value as number;
        return (
          <div className={available === 0 ? 'text-red-500 font-semibold' : ''}>
            {available}
          </div>
        );
      },
      hidden: true,
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: (value) => (
        <div className="max-w-xs truncate text-gray-500">{value || '-'}</div>
      ),
      hidden: true,
    },
  ];

  // Define columns for ordering table
  const orderingColumns: OrderingTableColumn<RankablePosition>[] = [
    {
      accessorKey: 'name',
      header: 'Position Name',
      cell: (value) => <div className="font-medium">{value}</div>,
    },
    {
      accessorKey: 'cca_name',
      header: 'CCA',
    },
    {
      accessorKey: 'position_type',
      header: 'Type',
      cell: (value) => <PositionTypeBadge value={String(value)} />,
    },
    {
      accessorKey: 'available_capacity',
      header: 'Available',
    },
  ];

  // ------------------------
  //  UI RENDERING
  // ------------------------
  if (loading || phaseLoading) {
    return (
      <AppLayout>
        <LoadingSpinner message="Loading your CCA rankings..." />
      </AppLayout>
    );
  }

  if (currentStep === 'selection') {
    return (
      <AppLayout>
        <div className="flex flex-col space-y-4 p-4">
          <div>
            <h1 className="text-2xl font-semibold">Select Committee Positions to Rank</h1>
            <p className="text-gray-600 mt-1">
              Choose positions you are interested in, then click &quot;Proceed to Ranking&quot;.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button onClick={proceedToRanking} disabled={selectedIds.size === 0}>
              Proceed to Ranking ({selectedIds.size}) →
            </Button>
          </div>

          <SelectionTable<RankablePosition, number>
            data={allPositions}
            columns={selectionColumns}
            selectedIds={selectedIds}
            onSelectionChange={togglePositionSelection}
            idField="id"
            searchColumn="name"
            searchPlaceholder="Filter by name, CCA, or description..."
            pageSize={10}
            emptyMessage="No positions found."
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col space-y-4 p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Rank Your Selected CCA Positions</h1>
            <p className="text-gray-600 mt-1">
              Drag rows to reorder. Your top choice should be ranked #1.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={backToSelection}>
              <ArrowLeft className="h-4 w-4" />
              Back to Selection
            </Button>
            <Button
              onClick={saveRankings}
              disabled={isSaving || !hasChanges}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Rankings'
              )}
            </Button>
          </div>
        </div>

        {hasChanges && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <p className="text-sm text-amber-800 font-medium">
              You have unsaved changes. Don&apos;t forget to save your rankings!
            </p>
          </div>
        )}

        <OrderingTable
          data={selectedPositions}
          columns={orderingColumns}
          onReorder={handleReorder}
          showRankColumn={true}
          emptyMessage="No positions selected."
        />
      </div>
    </AppLayout>
  );
}
