'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from "sonner";
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
import { getRankingScore, hasRequiredRankingInputs, isResidentPositionType } from '@/lib/cca-ranking-metrics';

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
  helpfulness: number;
  initiative: number;
  attitude: number;
}

type RankingsApiMember = {
  user_id: number;
  name: string;
  position_id: number;
  position: string;
  position_type: string;
  cut_status: CutStatus | null;
  commitment_period: CommitmentPeriod | null;
  ranking: number;
  attendance: number;
  performance: number;
  helpfulness: number;
  initiative: number;
  attitude: number;
  remarks?: string | null;
};

type RankingsApiResponse = {
  members: RankingsApiMember[];
  cca_type?: string | null;
  cca_name?: string | null;
};

type PositionGroup = {
  position_id: number;
  position: string;
  position_type: string;
  members: CCAMember[];
};

type RankingSavePayload = {
  user_id: number;
  position_id: number;
  ranking: number;
  attendance: number;
  performance: number;
  helpfulness: number;
  initiative: number;
  attitude: number;
  remarks: string;
};

const POSITION_TYPE_ORDER: Record<string, number> = {
  lead: 1,
  vice: 2,
  maincomm: 3,
  blockcomm: 4,
  subcomm: 5,
  'team manager': 6,
  member: 7,
  resident: 8,
};

const cloneMembers = (items: CCAMember[]): CCAMember[] => items.map((member) => ({ ...member }));
const MAX_SAVE_PAYLOAD_BYTES = 4_500_000;
const textEncoder = new TextEncoder();
const SCORE_OPTIONS = Array.from({ length: 10 }, (_, index) => index + 1);
const RESIDENT_METRICS = [
  { field: 'helpfulness', label: 'Helpfulness' },
  { field: 'initiative', label: 'Initiative' },
  { field: 'attitude', label: 'Attitude' },
] as const;
type ScoreField = 'attendance' | 'performance' | 'helpfulness' | 'initiative' | 'attitude';

const rankMembersWithinPosition = (members: CCAMember[], ccaType: string): CCAMember[] => {
  const sorted = [...members].sort((a, b) => {
    const aHasInputs = hasRequiredRankingInputs(a, { ccaType, positionType: a.position_type });
    const bHasInputs = hasRequiredRankingInputs(b, { ccaType, positionType: b.position_type });

    // Incomplete rows (empty score inputs) stay at bottom.
    if (aHasInputs !== bHasInputs) return aHasInputs ? -1 : 1;

    const aScore = getRankingScore(a, { ccaType, positionType: a.position_type });
    const bScore = getRankingScore(b, { ccaType, positionType: b.position_type });
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
        helpfulness: member.helpfulness,
        initiative: member.initiative,
        attitude: member.attitude,
        remarks: member.remarks || '',
      }))
  );
};

const toRankingSavePayload = (member: CCAMember): RankingSavePayload => ({
  user_id: member.user_id,
  position_id: member.position_id,
  ranking: member.ranking,
  attendance: member.attendance,
  performance: member.performance,
  helpfulness: member.helpfulness,
  initiative: member.initiative,
  attitude: member.attitude,
  remarks: member.remarks,
});

const buildMemberComparisonSnapshot = (member: CCAMember) => JSON.stringify({
  user_id: member.user_id,
  position_id: member.position_id,
  ranking: member.ranking,
  attendance: member.attendance,
  performance: member.performance,
  helpfulness: member.helpfulness,
  initiative: member.initiative,
  attitude: member.attitude,
  remarks: member.remarks || '',
});

const getChangedRankingPayloads = (members: CCAMember[], initialMembers: CCAMember[]) => {
  const initialSnapshots = new Map(
    initialMembers.map((member) => [member.row_key, buildMemberComparisonSnapshot(member)])
  );

  return [...members]
    .sort((a, b) => a.position_id - b.position_id || a.ranking - b.ranking || a.user_id - b.user_id)
    .filter((member) => initialSnapshots.get(member.row_key) !== buildMemberComparisonSnapshot(member))
    .map(toRankingSavePayload);
};

const chunkRankingPayloads = (payloads: RankingSavePayload[], maxBytes: number) => {
  const chunks: RankingSavePayload[][] = [];
  let currentChunk: RankingSavePayload[] = [];
  let currentChunkSize = 2;

  payloads.forEach((payload) => {
    const payloadSize = textEncoder.encode(JSON.stringify(payload)).length;
    if (payloadSize > maxBytes) {
      throw new Error(`Ranking for user ${payload.user_id} is too large to save in a single request`);
    }

    const nextChunkSize = currentChunkSize + (currentChunk.length > 0 ? 1 : 0) + payloadSize;
    if (currentChunk.length > 0 && nextChunkSize > maxBytes) {
      chunks.push(currentChunk);
      currentChunk = [payload];
      currentChunkSize = 2 + payloadSize;
      return;
    }

    currentChunk.push(payload);
    currentChunkSize = nextChunkSize;
  });

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
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
        row_key: `${member.user_id}:${member.position_id}`,
        user_id: member.user_id,
        name: member.name,
        position: member.position,
        position_type: member.position_type || '',
        position_id: member.position_id,
        cut_status: member.cut_status,
        commitment_period: member.commitment_period,
        ranking: member.ranking ?? 0,
        attendance: member.attendance ?? 0,
        performance: member.performance ?? 0,
        helpfulness: member.helpfulness ?? 0,
        initiative: member.initiative ?? 0,
        attitude: member.attitude ?? 0,
        remarks: member.remarks ?? '',
      }));

      const normalizedMembers = recalculateRankings(formattedMembers, data.cca_type || '');
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
  }, []);

  useEffect(() => {
    if (user && ccaId) {
      void loadRankings(ccaId);
    }
  }, [user, ccaId, loadRankings]);

  const unrankedCount = useMemo(() => {
    return members.filter(
      (member) => !hasRequiredRankingInputs(member, { ccaType, positionType: member.position_type })
    ).length;
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
    const changedRankings = getChangedRankingPayloads(members, initialMembers);

    try {
      if (changedRankings.length === 0) {
        toast.success('No ranking changes to save.');
        return;
      }

      const rankingChunks = chunkRankingPayloads(changedRankings, MAX_SAVE_PAYLOAD_BYTES);

      for (const rankingChunk of rankingChunks) {
        const res = await fetch(`/api/cca/${ccaId}/rankings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rankingChunk),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to save rankings');
        }
      }

      toast.success(
        rankingChunks.length > 1
          ? `Saved ${changedRankings.length} rankings in ${rankingChunks.length} batches.`
          : 'Rankings saved successfully!'
      );
      setInitialMembers(cloneMembers(members));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save rankings';
      console.error('Error saving rankings:', error);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const renderScoreSelect = (member: CCAMember, field: ScoreField) => (
    <select
      value={member[field] || 0}
      onChange={(e) => handleFieldChange(member.row_key, field, parseInt(e.target.value, 10))}
      className="w-20 p-2 border rounded-md bg-background text-sm"
    >
      <option value={0}>-</option>
      {SCORE_OPTIONS.map((score) => (
        <option key={score} value={score}>
          {score}
        </option>
      ))}
    </select>
  );

  if (!user) return <AppLoading />;

  return (
    <AppLayout>
      <div className="flex flex-col space-y-4 p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-semibold">Chair / Maincomm Ranking</h1>
          <div className="flex flex-wrap items-center gap-4">
            <Button onClick={handleSave} disabled={isSaving || !hasChanges} size="lg" className="bg-green-500 text-white hover:bg-green-400 px-6 py-4 shadow-md font-bold cursor-pointer">
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />Save Rankings</>}
            </Button>
            <Link href="/dashboard/mycca/admin">
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
              You have {unrankedCount} member{unrankedCount !== 1 ? 's' : ''} left to rank.
              Complete the required score inputs for each member to finalize the order.
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
            {positionGroups.map((group) => {
              const isResidentGroup = isResidentPositionType(group.position_type);

              return (
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
                          {!isResidentGroup && (ccaType === 'sports' ? (
                            <TableHead>Status</TableHead>
                          ) : (
                            <TableHead>Commitment</TableHead>
                          ))}
                          {isResidentGroup ? (
                            RESIDENT_METRICS.map((metric) => (
                              <TableHead key={metric.field}>{metric.label} (1-10)</TableHead>
                            ))
                          ) : (
                            <TableHead>
                              {ccaType === 'sports' ? "Captain's Appraisal (1-10)" : 'Attendance and Attitude (1-10)'}
                            </TableHead>
                          )}
                          {!isResidentGroup && ccaType !== 'sports' && <TableHead>Performance (1-10)</TableHead>}
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
                            {!isResidentGroup && (ccaType === 'sports' ? (
                              <TableCell className="text-sm">{formatCutStatus(member.cut_status)}</TableCell>
                            ) : (
                              <TableCell className="text-sm">
                                {formatCommitmentPeriod(member.commitment_period)}
                              </TableCell>
                            ))}
                            {isResidentGroup ? (
                              RESIDENT_METRICS.map((metric) => (
                                <TableCell key={metric.field}>
                                  {renderScoreSelect(member, metric.field)}
                                </TableCell>
                              ))
                            ) : (
                              <TableCell>
                                {renderScoreSelect(member, 'attendance')}
                              </TableCell>
                            )}
                            {!isResidentGroup && ccaType !== 'sports' && (
                              <TableCell>
                                {renderScoreSelect(member, 'performance')}
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
              );
            })}
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
