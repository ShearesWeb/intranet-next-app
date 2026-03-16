'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AppLayout } from '@/components/layout/app-layout';
import { AppLoading } from '@/components/layout/app-loading';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PositionTypeBadge } from '@/components/badges/position-type-badge';
import { CutStatus, CommitmentPeriod } from '@/types/dashboard';

type CCAMember = {
  row_key: string;
  user_id: number;
  name: string;
  position: string;
  position_type: string;
  position_id: number;
  ranking: number;
  remarks: string;
  cut_status?: CutStatus | null;
  commitment_period?: CommitmentPeriod | null;
  attendance: number;
  performance: number;
};

type RankingsApiMember = {
  user_id: number;
  cut_status: CutStatus | null;
  commitment_period: CommitmentPeriod | null;
  public_user_info: { id: number; name: string };
  cca_positions: { id: number; name: string; position_type?: string };
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

type PositionGroup = {
  position_id: number;
  position: string;
  position_type: string;
  members: CCAMember[];
};

const POSITION_TYPE_ORDER: Record<string, number> = {
  lead: 1,
  vice: 2,
  maincomm: 3,
  blockcomm: 4,
  subcomm: 5,
  'team manager': 6,
  member: 7,
};

const hasRankingInputs = (member: CCAMember, ccaType: string) => {
  if (ccaType === 'sports') {
    return member.attendance > 0;
  }
  if (ccaType === 'culture') {
    return member.attendance > 0 && member.performance > 0;
  }
  return member.attendance > 0 && member.performance > 0;
};

const getRankingScore = (member: CCAMember, ccaType: string) => {
  if (ccaType === 'sports') {
    return member.attendance;
  }
  if (ccaType === 'culture') {
    return member.attendance + member.performance;
  }
  return member.attendance + member.performance;
};

const rankMembersWithinPosition = (members: CCAMember[], ccaType: string): CCAMember[] => {
  const sorted = [...members].sort((a, b) => {
    const aHasInputs = hasRankingInputs(a, ccaType);
    const bHasInputs = hasRankingInputs(b, ccaType);

    if (aHasInputs !== bHasInputs) return aHasInputs ? -1 : 1;

    const aScore = getRankingScore(a, ccaType);
    const bScore = getRankingScore(b, ccaType);
    if (aScore !== bScore) return bScore - aScore;

    return a.name.localeCompare(b.name);
  });

  return sorted.map((member, index) => ({
    ...member,
    ranking: index + 1,
  }));
};

const recalculateRankings = (items: CCAMember[], ccaType: string): CCAMember[] => {
  const grouped = new Map<number, CCAMember[]>();
  items.forEach((member) => {
    const existing = grouped.get(member.position_id) || [];
    existing.push(member);
    grouped.set(member.position_id, existing);
  });

  const ranked: CCAMember[] = [];
  grouped.forEach((positionMembers) => {
    ranked.push(...rankMembersWithinPosition(positionMembers, ccaType));
  });

  return ranked;
};

const formatCutStatus = (status: unknown): string => {
  if (typeof status !== 'string' || status.trim().length === 0) return '-';
  const normalized = status.toLowerCase().trim().replace(/[_\s]+/g, '-');
  const statusMap: Record<string, string> = {
    'ivp-ihg-team': 'IVP & IHG Team',
    'ihg-team': 'IHG Team Only',
    'final-cut': 'Final Cut',
    'first-cut': 'IVP',
  };
  return statusMap[normalized] || status;
};

const formatCommitmentPeriod = (period: CommitmentPeriod | null | undefined): string => {
  const commitmentMap: Record<string, string> = {
    'full-year': 'Full Year',
    'semester-1': 'Semester 1',
    'semester-2': 'Semester 2',
  };
  if (!period) return '-';
  return commitmentMap[period] || '-';
};

const displayScore = (value: number) => (value > 0 ? value : '-');

export default function AdminViewRankingsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const ccaId = searchParams.get('ccaId');

  const [isLoading, setIsLoading] = useState(true);
  const [members, setMembers] = useState<CCAMember[]>([]);
  const [ccaType, setCcaType] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const loadRankings = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/cca/${id}/rankings`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch rankings');
      }

      const data = (await response.json()) as RankingsApiResponse;
      const formattedMembers: CCAMember[] = data.members.map((member) => ({
        row_key: `${member.user_id}:${member.cca_positions.id}`,
        user_id: member.user_id,
        name: member.public_user_info.name,
        position: member.cca_positions.name,
        position_type: member.cca_positions.position_type || '',
        position_id: member.cca_positions.id,
        cut_status: member.cut_status,
        commitment_period: member.commitment_period,
        ranking: member.cca_member_rankings?.[0]?.ranking ?? 0,
        attendance: member.cca_member_rankings?.[0]?.attendance ?? 0,
        performance: member.cca_member_rankings?.[0]?.performance ?? 0,
        remarks: member.cca_member_rankings?.[0]?.remarks ?? '',
      }));

      const normalizedMembers = recalculateRankings(formattedMembers, data.cca_type || '');
      setMembers(normalizedMembers);
      setCcaType(data.cca_type || '');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load rankings';
      console.error('Error loading rankings:', error);
      setMembers([]);
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user || !ccaId) {
      setIsLoading(false);
      return;
    }

    void loadRankings(ccaId);
  }, [user, ccaId, loadRankings]);

  const positionGroups = useMemo<PositionGroup[]>(() => {
    const groups = new Map<number, PositionGroup>();
    members.forEach((member) => {
      const existing = groups.get(member.position_id);
      if (!existing) {
        groups.set(member.position_id, {
          position_id: member.position_id,
          position: member.position,
          position_type: member.position_type,
          members: [member],
        });
        return;
      }
      existing.members.push(member);
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        members: [...group.members].sort((a, b) => a.ranking - b.ranking || a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => {
        const orderA = POSITION_TYPE_ORDER[(a.position_type || '').toLowerCase()] ?? 99;
        const orderB = POSITION_TYPE_ORDER[(b.position_type || '').toLowerCase()] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.position.localeCompare(b.position);
      });
  }, [members]);

  if (!user) return <AppLoading />;

  return (
    <AppLayout>
      <div className="flex flex-col space-y-4 p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold">CCA Rankings (Read Only)</h1>
          <Link href="/dashboard/managecca">
            <Button variant="outline" size="lg" className="px-6 py-4">
              <ArrowLeft className="h-4 w-4" /> Back to Manage CCAs
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><LoadingSpinner /></div>
        ) : error ? (
          <Alert className="bg-yellow-50 border-yellow-200">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800">Unable to load rankings</AlertTitle>
            <AlertDescription className="text-yellow-700">
              {error}
            </AlertDescription>
          </Alert>
        ) : positionGroups.length > 0 ? (
          <div className="space-y-6">
            {positionGroups.map((group) => (
              <Card key={group.position_id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{group.position}</span>
                      <PositionTypeBadge
                        value={(group.position_type || 'unknown').replace(/_/g, ' ').toLowerCase()}
                        position_type={group.position_type}
                        className="h-5 px-2 py-0 text-[11px] lowercase"
                      />
                    </div>
                  </CardTitle>
                  <CardDescription>
                    {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[88px]">Rank</TableHead>
                          <TableHead>Name</TableHead>
                          {ccaType === 'sports' ? (
                            <TableHead>Status</TableHead>
                          ) : (
                            <TableHead>Commitment</TableHead>
                          )}
                          <TableHead>
                            {ccaType === 'sports' ? "Captain's Appraisal" : 'Attendance and Attitude'}
                          </TableHead>
                          {ccaType !== 'sports' && <TableHead>Performance</TableHead>}
                          <TableHead>Remarks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.members.map((member) => (
                          <TableRow key={member.row_key}>
                            <TableCell>
                              <div className="ml-2 flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold text-lg">
                                {member.ranking}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{member.name}</TableCell>
                            {ccaType === 'sports' ? (
                              <TableCell className="text-sm">{formatCutStatus(member.cut_status)}</TableCell>
                            ) : (
                              <TableCell className="text-sm">{formatCommitmentPeriod(member.commitment_period)}</TableCell>
                            )}
                            <TableCell>{displayScore(member.attendance)}</TableCell>
                            {ccaType !== 'sports' && (
                              <TableCell>{displayScore(member.performance)}</TableCell>
                            )}
                            <TableCell className="min-w-[220px] whitespace-pre-wrap">
                              {member.remarks?.trim() || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="p-4 border border-dashed border-gray-300 rounded-md text-gray-500 text-center">No ranked members found</div>
        )}
      </div>
    </AppLayout>
  );
}
