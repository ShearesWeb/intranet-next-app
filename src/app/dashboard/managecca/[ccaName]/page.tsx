'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { AppLayout } from '@/components/layout/app-layout';
import { AppLoading } from '@/components/layout/app-loading';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { OrderingTable, type OrderingTableColumn } from '@/components/table/ordering-table';
import { Textarea } from '@/components/ui/textarea';
import { Save, Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { CutStatus, CommitmentPeriod } from '@/types/dashboard';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export interface CCAMember {
  id: number;
  user_id: number;
  name: string;
  position: string;
  position_id: number;
  ranking: number;
  remarks: string;
  cut_status?: CutStatus | null;
  commitment_period?: CommitmentPeriod | null;
  attendance: number;
  performance: number;
}

type RankingsApiMember = {
  user_id: number;
  cut_status: CutStatus | null;
  commitment_period: CommitmentPeriod | null;
  public_user_info: { id: number; name: string };
  cca_positions: { id: number; name: string };
  cca_member_rankings?: Array<{
    ranking?: number | null;
    attendance?: number | null;
    performance?: number | null;
    remarks?: string | null;
  }>;
};

type RankingsApiResponse = {
  members: RankingsApiMember[];
  cca_type?: string | null;
};

export default function CCARankingPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const ccaId = searchParams.get('ccaId');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [members, setMembers] = useState<CCAMember[]>([]);
  const [initialMembers, setInitialMembers] = useState<CCAMember[]>([]);
  const [ccaType, setCcaType] = useState<string>('');

  useEffect(() => {
    if (user && ccaId) {
      loadRankings(ccaId);
    }
  }, [user, ccaId]);

  const loadRankings = async (id: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/cca/${id}/rankings`);
      if (!response.ok) throw new Error('Failed to fetch rankings');
      
      const data = (await response.json()) as RankingsApiResponse;
      const rawMembers = data.members;
      const cca_type = data.cca_type;
      
      const formattedMembers: CCAMember[] = rawMembers.map((m, index) => ({
        id: m.user_id,
        user_id: m.user_id,
        name: m.public_user_info.name,
        position: m.cca_positions.name,
        position_id: m.cca_positions.id,
        cut_status: m.cut_status,
        commitment_period: m.commitment_period,
        ranking: m.cca_member_rankings?.[0]?.ranking || index + 1,
        attendance: m.cca_member_rankings?.[0]?.attendance || 0,
        performance: m.cca_member_rankings?.[0]?.performance || 0,
        remarks: m.cca_member_rankings?.[0]?.remarks || '',
      }));

      setMembers(formattedMembers);
      setInitialMembers(JSON.parse(JSON.stringify(formattedMembers)));
      setCcaType(cca_type || '');
    } catch (error) {
      console.error('Error loading rankings:', error);
      toast.error('Failed to load rankings');
    } finally {
      setIsLoading(false);
    }
  };

  const unrankedCount = useMemo(() => {
      const isSports = ccaType === 'sports' || ccaType === 'culture';
      return members.filter(m => {
          if (isSports) return m.attendance === 0;
          return m.attendance === 0 || m.performance === 0;
      }).length;
  }, [members, ccaType]);

  const hasChanges = useMemo(() => {
      return JSON.stringify(members) !== JSON.stringify(initialMembers);
  }, [members, initialMembers]);

  const handleReorder = (newMembers: CCAMember[]) => {
    const rankedMembers = newMembers.map((member, index) => ({
      ...member,
      ranking: index + 1,
    }));
    setMembers(rankedMembers);
  };

  const handleFieldChange = <K extends keyof CCAMember>(id: number, field: K, value: CCAMember[K]) => {
    setMembers(prev => prev.map(member => 
      member.id === id ? { ...member, [field]: value } : member
    ));
  };

  const handleSave = async () => {
    if (!ccaId) return;
    setIsSaving(true);
    const rankingsToSave = members.map((m) => ({
      user_id: m.user_id,
      position_id: m.position_id,
      ranking: m.ranking,
      attendance: m.attendance,
      performance: m.performance,
      remarks: m.remarks,
    }));

    try {
        const res = await fetch(`/api/cca/${ccaId}/rankings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rankingsToSave)
        });
        if (!res.ok) throw new Error('Failed to save rankings');
        toast.success('Rankings saved successfully!');
        setInitialMembers(JSON.parse(JSON.stringify(members)));
    } catch (error) {
      console.error('Error saving rankings:', error);
      toast.error('Failed to save rankings');
    } finally {
      setIsSaving(false);
    }
  };

  const columns = useMemo<OrderingTableColumn<CCAMember>[]>(() => {
    const isSports = ccaType === 'sports';
    
    const cols: OrderingTableColumn<CCAMember>[] = [
        { accessorKey: 'name', header: 'Name' },
        { accessorKey: 'position', header: 'Position' },
    ];

    if (isSports) {
        cols.push({
            accessorKey: 'cut_status',
            header: 'Status',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            cell: (value: any) => {
                const statusMap: Record<string, string> = {
                    'ivp-ihg-team': 'IVP & IHG Team',
                    'ihg-team': 'IHG Team Only',
                    'final-cut': 'Final Cut'
                };
                return <span className="text-sm">{statusMap[value] || '-'}</span>;
            }
        });
    } else {
        cols.push({
            accessorKey: 'commitment_period',
            header: 'Commitment',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            cell: (value: any) => {
                const commitmentMap: Record<string, string> = {
                    'full-year': 'Full Year',
                    'semester-1': 'Semester 1',
                    'semester-2': 'Semester 2'
                };
                return <span className="text-sm">{commitmentMap[value] || '-'}</span>;
            }
        });
    }

    cols.push({
        accessorKey: 'attendance',
        header: 'Attendance (1-10)',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cell: (value: any, row: CCAMember) => (
            <select
                value={value || 0}
                onChange={(e) => handleFieldChange(row.id, 'attendance', parseInt(e.target.value))}
                className="w-20 p-2 border rounded-md bg-background text-sm"
            >
                <option value={0}>-</option>
                {[...Array(10)].map((_, i) => (<option key={i+1} value={i+1}>{i+1}</option>))}
            </select>
        )
    });

    if (!isSports) {
        cols.push({
            accessorKey: 'performance',
            header: 'Performance (1-10)',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            cell: (value: any, row: CCAMember) => (
                <select
                    value={value || 0}
                    onChange={(e) => handleFieldChange(row.id, 'performance', parseInt(e.target.value))}
                    className="w-20 p-2 border rounded-md bg-background text-sm"
                >
                    <option value={0}>-</option>
                    {[...Array(10)].map((_, i) => (<option key={i+1} value={i+1}>{i+1}</option>))}
                </select>
            )
        });
    }

    cols.push({
        accessorKey: 'remarks',
        header: 'Remarks',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cell: (value: any, row: CCAMember) => (
            <Textarea
                value={value || ''}
                onChange={(e) => handleFieldChange(row.id, 'remarks', e.target.value)}
                placeholder="Enter remarks"
                className="min-h-[60px] text-sm"
            />
        ),
    });

    return cols;
  }, [ccaType]);

  if (!user) return <AppLoading />;

  return (
    <AppLayout>
      <div className="flex flex-col space-y-4 p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold">Chair / Maincomm Ranking</h1>
          <div className="flex items-center gap-4">
            <Button onClick={handleSave} disabled={isSaving || !hasChanges} size="lg" className="bg-green-500 text-white hover:bg-green-400 px-6 py-4 shadow-md font-bold cursor-pointer">
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />Save Rankings</>}
            </Button>
            <Link href="/dashboard/managecca">
                <Button variant="outline" size="lg" className="px-6 py-4">
                    <ArrowLeft className="h-4 w-4" /> Back to my CCAs
                </Button>
            </Link>
          </div>
        </div>

        {unrankedCount > 0 && (
            <Alert className="mb-4 bg-yellow-50 border-yellow-200">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertTitle className="text-yellow-800">Pending Rankings</AlertTitle>
                <AlertDescription className="text-yellow-700">
                    You have {unrankedCount} member{unrankedCount !== 1 ? 's' : ''} left to rank (fill in attendance{ccaType !== 'sports' && ccaType !== 'culture' ? ' and performance' : ''}).
                </AlertDescription>
            </Alert>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8"><LoadingSpinner /></div>
        ) : members.length > 0 ? (
            <div className="mb-8">
              <OrderingTable data={members} columns={columns} onReorder={handleReorder} showRankColumn={true} />
              <div className="mt-4 text-sm text-muted-foreground">
                <p>💡 Drag and drop to reorder members. Higher ranked members will receive more points.</p>
              </div>
            </div>
        ) : (
            <div className="p-4 border border-dashed border-gray-300 rounded-md text-gray-500 text-center">No members found</div>
        )}
      </div>
    </AppLayout>
  );
}
