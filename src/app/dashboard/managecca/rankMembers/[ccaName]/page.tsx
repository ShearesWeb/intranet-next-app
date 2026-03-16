'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { AppLayout } from '@/components/layout/app-layout';
import { AppLoading } from '@/components/layout/app-loading';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Textarea } from '@/components/ui/textarea';
import { Save, Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { CutStatus, CommitmentPeriod } from '@/types/dashboard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PositionTypeBadge } from '@/components/badges/position-type-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { buildCcaPositionAccess, RankingAccessPosition } from '@/lib/cca-rankings-access';

export interface CCAMember {
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
}

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

const cloneMembers = (items: CCAMember[]): CCAMember[] => items.map((member) => ({ ...member }));

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

    // Incomplete rows (empty score inputs) stay at bottom.
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

const buildComparisonSnapshot = (items: CCAMember[]) => {
  return JSON.stringify(
    [...items]
      .sort((a, b) => a.position_id - b.position_id || a.ranking - b.ranking || a.user_id - b.user_id)
      .map((member) => ({
        row_key: member.row_key,
        user_id: member.user_id,
        position_id: member.position_id,
        ranking: member.ranking,
        attendance: member.attendance,
        performance: member.performance,
        remarks: member.remarks || '',
      }))
  );
};

const formatCutStatus = (status: unknown): string => {
  if (typeof status !== 'string' || status.trim().length === 0) return '-';
  const normalized = status.toLowerCase().trim().replace(/[_\s]+/g, '-');
  const statusMap: Record<string, string> = {
    'ivp-ihg-team': 'IVP & IHG Team',
    'ihg-team': 'IHG Team Only',
    'final-cut': 'Final Cut',
  };

  if (statusMap[normalized]) return statusMap[normalized];
  return status;
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

export default function CCARankingPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const ccaId = searchParams.get('ccaId');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [members, setMembers] = useState<CCAMember[]>([]);
  const [initialMembers, setInitialMembers] = useState<CCAMember[]>([]);
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

      const availablePositions = Array.from(
        new Map(
          formattedMembers.map((member) => [
            member.position_id,
            {
              id: member.position_id,
              cca_id: Number(id),
              name: member.position,
              position_type: member.position_type,
            } satisfies RankingAccessPosition,
          ])
        ).values()
      );

      const visiblePositionIds = new Set(
        buildCcaPositionAccess({
          requestingUser: user,
          cca: { id: Number(id), cca_type: data.cca_type || null },
          positions: availablePositions,
        })
          .filter((position) => position.canRank)
          .map((position) => position.id)
      );

      const visibleMembers = formattedMembers.filter((member) => {
        if (!visiblePositionIds.has(member.position_id)) {
          return false;
        }

        if (data.cca_type === 'sports' && member.position_type === 'member') {
          return member.cut_status !== null;
        }

        return true;
      });
      const normalizedMembers = recalculateRankings(visibleMembers, data.cca_type || '');
      setMembers(normalizedMembers);
      setInitialMembers(cloneMembers(normalizedMembers));
      setCcaType(data.cca_type || '');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch rankings';
      console.error('Error loading rankings:', error);
      setMembers([]);
      setInitialMembers([]);
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && ccaId) {
      void loadRankings(ccaId);
    }
  }, [user, ccaId, loadRankings]);

  const unrankedCount = useMemo(() => {
    return members.filter((member) => {
      if (ccaType === 'sports') {
        return member.attendance === 0;
      }
      if (ccaType === 'culture') {
        return member.attendance === 0 || member.performance === 0;
      }
      return member.attendance === 0 || member.performance === 0;
    }).length;
  }, [members, ccaType]);

  const hasChanges = useMemo(() => {
    return buildComparisonSnapshot(members) !== buildComparisonSnapshot(initialMembers);
  }, [members, initialMembers]);

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
        members: [...group.members].sort(
          (a, b) => a.ranking - b.ranking || a.name.localeCompare(b.name)
        ),
      }))
      .sort((a, b) => {
        const orderA = POSITION_TYPE_ORDER[(a.position_type || '').toLowerCase()] ?? 99;
        const orderB = POSITION_TYPE_ORDER[(b.position_type || '').toLowerCase()] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.position.localeCompare(b.position);
      });
  }, [members]);

  const handleFieldChange = useCallback(<K extends keyof CCAMember>(rowKey: string, field: K, value: CCAMember[K]) => {
    setMembers((prev) => {
      const updated = prev.map((member) =>
        member.row_key === rowKey ? { ...member, [field]: value } : member
      );
      return recalculateRankings(updated, ccaType);
    });
  }, [ccaType]);

  const handleSave = async () => {
    if (!ccaId) return;
    setIsSaving(true);
    const rankingsToSave = [...members]
      .sort((a, b) => a.position_id - b.position_id || a.ranking - b.ranking || a.user_id - b.user_id)
      .map((member) => ({
        user_id: member.user_id,
        position_id: member.position_id,
        ranking: member.ranking,
        attendance: member.attendance,
        performance: member.performance,
        remarks: member.remarks,
      }));

    try {
      const res = await fetch(`/api/cca/${ccaId}/rankings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rankingsToSave),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save rankings');
      }
      toast.success('Rankings saved successfully!');
      setInitialMembers(cloneMembers(members));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save rankings';
      console.error('Error saving rankings:', error);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

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
              You have {unrankedCount} member{unrankedCount !== 1 ? 's' : ''} left to rank (
              fill in {ccaType === 'sports' ? "captain's appraisal" : 'attendance and attitude'}
              {ccaType === 'sports' ? '' : ' and performance'}).
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8"><LoadingSpinner /></div>
        ) : error ? (
          <Alert className="mb-4 bg-yellow-50 border-yellow-200">
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
                      <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
                        <PositionTypeBadge
                          value={(group.position_type || 'unknown').replace(/_/g, ' ').toLowerCase()}
                          position_type={group.position_type}
                          className="h-5 px-2 py-0 text-[11px] lowercase"
                        />
                      </span>
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
                            {ccaType === 'sports' ? "Captain's Appraisal (1-10)" : 'Attendance and Attitude (1-10)'}
                          </TableHead>
                          {ccaType !== 'sports' && <TableHead>Performance (1-10)</TableHead>}
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
                              <TableCell className="text-sm">
                                {formatCommitmentPeriod(member.commitment_period)}
                              </TableCell>
                            )}
                            <TableCell>
                              <select
                                value={member.attendance || 0}
                                onChange={(e) => handleFieldChange(member.row_key, 'attendance', parseInt(e.target.value, 10))}
                                className="w-20 p-2 border rounded-md bg-background text-sm"
                              >
                                <option value={0}>-</option>
                                {[...Array(10)].map((_, i) => (
                                  <option key={i + 1} value={i + 1}>
                                    {i + 1}
                                  </option>
                                ))}
                              </select>
                            </TableCell>
                            {ccaType !== 'sports' && (
                              <TableCell>
                                <select
                                  value={member.performance || 0}
                                  onChange={(e) => handleFieldChange(member.row_key, 'performance', parseInt(e.target.value, 10))}
                                  className="w-20 p-2 border rounded-md bg-background text-sm"
                                >
                                  <option value={0}>-</option>
                                  {[...Array(10)].map((_, i) => (
                                    <option key={i + 1} value={i + 1}>
                                      {i + 1}
                                    </option>
                                  ))}
                                </select>
                              </TableCell>
                            )}
                            <TableCell className="min-w-[220px]">
                              <Textarea
                                value={member.remarks || ''}
                                onChange={(e) => handleFieldChange(member.row_key, 'remarks', e.target.value)}
                                placeholder="Enter remarks"
                                className="min-h-[60px] text-sm"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ))}
            <div className="text-sm text-muted-foreground">
              Ranking updates automatically based on score.
            </div>
          </div>
        ) : (
          <div className="p-4 border border-dashed border-gray-300 rounded-md text-gray-500 text-center">No members found</div>
        )}
      </div>
    </AppLayout>
  );
}
