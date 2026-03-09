// src/app/dashboard/managecca/manageMembers/[cca_name]/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { AppLayout } from '@/components/layout/app-layout';
import { Member, PendingChange, UserSearchResult, CutStatus, CommitmentPeriod } from '@/types/dashboard';

// shadcn UI
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircleIcon, ArrowLeft, Volleyball, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Custom table component
import { SimpleTable, SimpleTableColumn } from "@/components/table/simple-table";
import Link from 'next/link';

// Define member table columns
const memberTableColumns: SimpleTableColumn<Member>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'room', header: 'Room' },
    { accessorKey: 'position_name', header: 'Position' },
];

export default function ManageMembersPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const ccaId = searchParams.get('ccaId');

    // Original state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [originalGroupedMembers, setOriginalGroupedMembers] = useState<any>({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [currentGroupedMembers, setCurrentGroupedMembers] = useState<any>({});

    // UI state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [cca, setCCA] = useState<any>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [permissions, setPermissions] = useState<any>({ canManageMembers: false, ccaType: '' });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [memberPositionId, setMemberPositionId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);

    // Modal state
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
    const [addForm, setAddForm] = useState<{ positionId: number; commitmentPeriod: CommitmentPeriod | '' }>({
        positionId: 0,
        commitmentPeriod: ''
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [allPositions, setAllPositions] = useState<any[]>([]);
    const [saveErrors, setSaveErrors] = useState<string[]>([]);

    // Pending changes
    const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);

    const fetchMembers = useCallback(async () => {
        try {
            setLoading(true);
            if (!ccaId) {
                throw new Error('CCA ID is required');
            }
            const response = await fetch(`/api/cca/${ccaId}/members`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch members');
            }

            const data = await response.json();
            setOriginalGroupedMembers(data.groupedMembers || {});
            setCurrentGroupedMembers(data.groupedMembers || {});
            setCCA(data.cca);
            setPermissions(data.permissions || { canManageMembers: false, ccaType: '' });
            setMemberPositionId(data.member_position_id || 0);
            setAllPositions(data.all_positions || []);
            setError(null);
            setPendingChanges([]); // Reset pending changes
        } catch (error: any) {
            console.error('Error fetching members:', error);
            setError(error.message);
            if (error.message.includes('Unauthorized')) {
                toast.error('You are not authorized to manage this CCA');
                router.push('/dashboard/managecca');
            } else {
                toast.error('Failed to load members');
            }
        } finally {
            setLoading(false);
        }
    }, [ccaId, router]);

    useEffect(() => {
        fetchMembers();
    }, [fetchMembers]);

    const handleSearchUsers = async () => {
        const query = userSearchQuery.trim();
        if (query.length < 2) {
            toast.error('Please enter at least 2 characters to search');
            setUserSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const response = await fetch(`/api/user/search?query=${encodeURIComponent(query)}`);
            const data = await response.json();
            setUserSearchResults(data.data || []);
        } catch (error) {
            console.error('Error searching users:', error);
            toast.error('Failed to search users');
        } finally {
            setIsSearching(false);
        }
    };

    const handleSearchKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearchUsers();
        }
    };

    // Local add member (doesn't call API yet)
    const handleLocalAddMember = (userId: number, userName: string, userEmail: string, userRoom?: string, positionId?: number, commitmentPeriod?: CommitmentPeriod) => {
        // Check if user is already a member or pending add
        const allCurrentMembers = Object.values(currentGroupedMembers).flat() as Member[];
        const isAlreadyMember = allCurrentMembers.some(member => member.user_id === userId);
        const isPendingAdd = pendingChanges.some(change =>
            change.type === 'add' && change.user_id === userId
        );

        if (isAlreadyMember || isPendingAdd) {
            toast.error('User is already a member or pending addition');
            return;
        }

        // Add to pending changes
        const newChange: PendingChange = {
            type: 'add',
            user_id: userId,
            user_name: userName,
            user_email: userEmail,
            user_room: userRoom || '',
            position_id: positionId,
            new_commitment_period: commitmentPeriod
        };

        setPendingChanges(prev => [...prev, newChange]);

        // Find position name
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const position = allPositions.find((p: any) => p.id === positionId);
        const positionName = position ? position.name : 'Member';

        // Add to current members display (for immediate UI feedback)
        const newMember: Member = {
            user_id: userId,
            name: userName,
            email: userEmail,
            room: userRoom || '',
            position_name: positionName,
            position_type: position?.position_type || 'member',
            points: 0,
            appointed_date: new Date().toISOString(),
            commitment_period: commitmentPeriod || null,
            position_id: positionId
        };

        setCurrentGroupedMembers((prev: any) => ({
            ...prev,
            members: [...(prev.members || []), newMember]
        }));

        toast.success(`${userName} added to pending changes`);

        // Clear search and selection
        setUserSearchQuery('');
        setUserSearchResults([]);
        setSelectedUser(null);
        setAddForm({ positionId: 0, commitmentPeriod: '' });
        setShowAddMemberModal(false);
    };

    // Local remove member
    const handleLocalRemoveMember = (userId: number, memberName: string) => {
        // Remove from pending adds or cut if exists
        setPendingChanges(prev =>
            prev.filter(
                change =>
                    !(
                        (change.type === 'add' || change.type === 'cut') &&
                        change.user_id === userId
                    )
            )
        );

        // Check if this is an original member (needs API removal)
        const allOriginalMembers = Object.values(originalGroupedMembers).flat() as Member[];
        const member = allOriginalMembers.find(m => m.user_id === userId);

        if (member) {
            // Add to pending removes
            const newChange: PendingChange = {
                type: 'remove',
                user_id: userId,
                user_name: memberName,
                user_email: '',
                position_id: member.position_id
            };
            setPendingChanges(prev => [...prev, newChange]);
        }

        // Remove from current display
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setCurrentGroupedMembers((prev: any) => {
            const updated = { ...prev };
            Object.keys(updated).forEach(key => {
                updated[key] = updated[key].filter((member: Member) => member.user_id !== userId);
            });
            return updated;
        });

        toast.success(`${memberName} marked for removal`);
    };

    const getGroupFromStatus = (status: CutStatus | undefined | null) => {
        switch (status) {
            case 'ivp-ihg-team': return 'ivpIhgTeam';
            case 'ihg-team': return 'ihgTeam';
            case 'final-cut': return 'finalCut';
            default: return 'members';
        }
    };

    const getStatusLabel = (status: CutStatus | undefined | null) => {
        switch (status) {
            case 'ivp-ihg-team': return 'Final Cut - IHG Team Members (IVP)';
            case 'ihg-team': return 'Final Cut - IHG Team Members';
            case 'final-cut': return 'Final Cut Members';
            default: return 'Members';
        }
    };

    // Local update status
    const handleLocalUpdateStatus = (userId: number, memberName: string, newStatus: CutStatus) => {
        // Find member in any group
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allCurrentMembers = Object.values(currentGroupedMembers).flat() as Member[];
        const member = allCurrentMembers.find(m => m.user_id === userId);

        if (!member) {
            toast.error(`${memberName} not found in current members`);
            return;
        }

        if (member.cut_status === newStatus) {
            toast.error(`${memberName} is already in this status`);
            return;
        }

        // Remove from pending adds if exists
        setPendingChanges(prev =>
            prev.filter(change => !(change.type === 'add' && change.user_id === userId))
        );

        // Add status change
        const newChange: PendingChange = {
            type: 'update_status',
            user_id: userId,
            user_name: memberName,
            user_email: member.email,
            user_room: member.room,
            new_status: newStatus,
        };
        setPendingChanges(prev => [...prev, newChange]);

        // Update currentGroupedMembers locally
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setCurrentGroupedMembers((prev: any) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updated: any = { ...prev };

            // Helper to remove member from any group
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const removeFromGroup = (group: any[]) => (group || []).filter((m: any) => m.user_id !== userId);

            Object.keys(updated).forEach(key => {
                updated[key] = removeFromGroup(updated[key]);
            });

            // Add to new group
            const targetGroup = getGroupFromStatus(newStatus);
            if (targetGroup) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                updated[targetGroup] = [...(updated[targetGroup] || []), { ...member, cut_status: newStatus }];
            }

            return updated;
        });

        toast.success(`Moved ${memberName} to ${getStatusLabel(newStatus)}`);
    };

    const handleLocalUpdateCommitment = (userId: number, newPeriod: CommitmentPeriod) => {
        // Find member
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allCurrentMembers = Object.values(currentGroupedMembers).flat() as Member[];
        const member = allCurrentMembers.find(m => m.user_id === userId);

        if (!member) {
            toast.error('Member not found');
            return;
        }

        if (member.commitment_period === newPeriod) return;

        // Add pending change
        const newChange: PendingChange = {
            type: 'update_commitment',
            user_id: userId,
            user_name: member.name,
            user_email: member.email,
            new_commitment_period: newPeriod,
            position_id: member.position_id
        };
        
        // If we don't have position_id on member, try fallback
        if (!newChange.position_id && memberPositionId) {
             newChange.position_id = memberPositionId;
        }

        setPendingChanges(prev => [...prev, newChange]);

        // Update local state
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setCurrentGroupedMembers((prev: any) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updated: any = { ...prev };
            Object.keys(updated).forEach(key => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                updated[key] = updated[key].map((m: any) => 
                    m.user_id === userId ? { ...m, commitment_period: newPeriod } : m
                );
            });
            return updated;
        });
        
        toast.success('Commitment period updated (pending save)');
    };

    // Save all pending changes
    const handleSaveMembers = async () => {
        if (pendingChanges.length === 0) {
            toast.error('No changes to save');
            return;
        }

        setSaving(true);
        setSaveErrors([]);
        let successCount = 0;
        let errorCount = 0;
        const currentErrors: string[] = [];

        try {
            for (const change of pendingChanges) {
                try {
                    if (change.type === 'add') {
                        const response = await fetch(`/api/cca/${ccaId}/addMember`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                user_id: change.user_id,
                                reason: 'Added by lead/vice',
                                position_id: change.position_id,
                                commitment_period: change.new_commitment_period
                            })
                        });

                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || 'Failed to add member');
                        }
                        successCount++;
                    } else if (change.type === 'remove') {
                        const response = await fetch(`/api/cca/${ccaId}/removeMember`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                user_id: change.user_id,
                                reason: 'Removed by lead/vice',
                                position_id: change.position_id
                            })
                        });

                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || 'Failed to remove member');
                        }
                        successCount++;
                    } else if (change.type === 'update_status') {
                        const response = await fetch(`/api/cca/${ccaId}/updateMember`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                user_id: change.user_id,
                                position_id: memberPositionId,
                                cut_status: change.new_status
                            })
                        });

                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || 'Failed to update member status');
                        }
                        successCount++;
                    } else if (change.type === 'update_commitment') {
                        const response = await fetch(`/api/cca/${ccaId}/updateMember`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                user_id: change.user_id,
                                position_id: change.position_id || memberPositionId,
                                commitment_period: change.new_commitment_period
                            })
                        });

                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || 'Failed to update commitment period');
                        }
                        successCount++;
                    }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } catch (error: any) {
                    console.error(`Error processing ${change.type} for ${change.user_name}:`, error);
                    errorCount++;
                    const errorMsg = error.message || 'Unknown error';
                    currentErrors.push(`${change.user_name}: ${errorMsg}`);
                }
            }

            if (successCount > 0) {
                toast.success(`Successfully processed ${successCount} changes`);
            }
            if (errorCount > 0) {
                setSaveErrors(currentErrors);
            }

            // Refresh data from server
            await fetchMembers();
        } catch (error) {
            console.error('Error saving members:', error);
            toast.error('Failed to save changes');
        } finally {
            setSaving(false);
        }
    };

    // Check if user is already added (locally or originally)
    const isUserAdded = (userId: number) => {
        const allCurrentMembers = Object.values(currentGroupedMembers).flat() as Member[];
        return allCurrentMembers.some(member => member.user_id === userId);
    };

    // Get button text for user in search results
    const getUserButtonText = (userId: number) => {
        return isUserAdded(userId) ? 'Remove' : 'Add';
    };

    // Handle adding/removing user from search results
    const handleUserButtonClick = (user: UserSearchResult) => {
        if (isUserAdded(user.id)) {
            handleLocalRemoveMember(user.id, user.name);
            return;
        }
        if (!isSportsCulture) {
            toast.error('Adding members is only available for sports and culture CCAs');
            return;
        }
        handleLocalAddMember(user.id, user.name, user.email, user.room || '');
    };

    if (loading) {
        return (
            <AppLayout>
                <LoadingSpinner message="Loading members..." />
            </AppLayout>
        );
    }

    if (error) {
        return (
            <AppLayout>
                <div className="flex-1 p-6">
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-gray-800">CCA Members</h1>
                    </div>

                    <Card className="bg-red-50 border-red-200">
                        <CardContent className="flex flex-col items-center p-6 gap-4">
                            <p className="text-red-700 font-medium text-center">⚠️ {error}</p>
                            <Button
                                variant="default"
                                className="bg-blue-500 text-white hover:bg-blue-400 px-6 py-4 shadow-md font-bold cursor-pointer"
                                onClick={() => router.push("/dashboard/managecca")}
                            >
                                Back to My CCAs
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </AppLayout>
        );
    }

    const renderMemberGroup = (
        title: string,
        members: Member[],
        showActionsColumn: boolean = false,
        showAddButton: boolean = false,
    ) => {
        if (members.length === 0 && !showActionsColumn && !showAddButton) return null;

        const canManage = permissions.canManageMembers;

        // Build columns based on whether we can manage
        const columnsToUse: SimpleTableColumn<Member>[] = (showActionsColumn && canManage)
            ? [
                ...memberTableColumns,
                ...(!isSportsCulture ? [{
                    accessorKey: 'commitment_period' as keyof Member,
                    header: 'Commitment',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    cell: (value: any, row: Member) => (
                        <select
                            value={value || 'full-year'}
                            onChange={(e) => handleLocalUpdateCommitment(row.user_id, e.target.value as CommitmentPeriod)}
                            className="border rounded p-1 text-sm bg-transparent cursor-pointer hover:bg-gray-100 w-28"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <option value="full-year">Full Year</option>
                            <option value="semester-1">Sem 1</option>
                            <option value="semester-2">Sem 2</option>
                        </select>
                    )
                }] : []),
                {
                    accessorKey: 'actions' as keyof Member,
                    header: 'Actions',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    cell: (_value: any, row: Member) => (
                        <div className="flex flex-wrap gap-3">
                            {isSportsCulture ? (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                            <span className="sr-only">Open menu</span>
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleLocalUpdateStatus(row.user_id, row.name, 'ivp-ihg-team')}>
                                            Move to IHG Team (IVP)
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleLocalUpdateStatus(row.user_id, row.name, 'ihg-team')}>
                                            Move to IHG Team
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleLocalUpdateStatus(row.user_id, row.name, 'final-cut')}>
                                            Move to Final Cut
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleLocalRemoveMember(row.user_id, row.name)} className="text-red-600">
                                            Remove Member
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            ) : (
                                <Button
                                    size="sm"
                                    onClick={() => handleLocalRemoveMember(row.user_id, row.name)}
                                    className="bg-red-500 text-white hover:bg-red-400 px-4 py-2 shadow-md font-bold cursor-pointer"
                                >
                                    Remove
                                </Button>
                            )}
                        </div>
                    ),
                },
            ]
            : memberTableColumns;

        return (
            <div className="mb-8">
                {/* Group Header */}
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">{title}</h3>
                    {canManage && showAddButton && isSportsCulture && (
                        <Button
                            onClick={() => setShowAddMemberModal(true)}
                            size="sm"
                            className="bg-green-500 text-white hover:bg-green-400 px-4 py-2 shadow-md font-bold cursor-pointer"
                        >
                            + Add Member
                        </Button>
                    )}
                </div>

                {/* Empty Section */}
                {members.length === 0 ? (
                    <div className="p-4 border border-dashed border-gray-300 rounded-md text-gray-500">
                        No {title.toLowerCase()} found.
                    </div>
                ) : (
                    <SimpleTable<Member>
                        searchColumn='name'
                        data={members}
                        columns={columnsToUse}
                        pageSize={8}
                        emptyMessage="No members"
                    />
                )}
            </div>
        );
    };

    const leadershipMembers = [...currentGroupedMembers.lead || [], ...currentGroupedMembers.vice || []];
    const isSportsCulture = ['sports', 'culture'].includes(permissions.ccaType);
    const totalFilteredMembers = Object.values(currentGroupedMembers).flat().length;

    return (
        <AppLayout>
            <div className="flex flex-col space-y-4 p-4">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-semibold">CCA Members - {cca?.name}</h1>
                    <div className="flex items-center gap-4">
                        {pendingChanges.length > 0 && (
                            <Button
                                onClick={handleSaveMembers}
                                disabled={saving}
                                size="lg"
                                className="bg-green-500 text-white hover:bg-green-400 px-6 py-4 shadow-md font-bold cursor-pointer"
                            >
                                {saving ? 'Saving...' : `Save Members (${pendingChanges.length})`}
                            </Button>
                        )}
                        <Link href="/dashboard/managecca">
                            <Button variant="outline" size="lg" className="px-6 py-4" >
                                <ArrowLeft className="h-4 w-4" />
                                Back to my CCAs
                            </Button>
                        </Link>
                    </div>
                </div>

                {pendingChanges.length > 0 && (
                    <Alert className="mb-4 bg-yellow-50 border-amber-600 py-3 rounded-sm">
                        <AlertCircleIcon color="#a96800" />
                        <AlertDescription className="text-yellow-700 ml-1">
                            <span>
                                <strong>{pendingChanges.length}</strong> pending changes. Click &quot;Save Members&quot; to apply.
                            </span>
                        </AlertDescription>
                    </Alert>
                )}

                {isSportsCulture && (
                    <Card className="mb-4 bg-sky-50 border-blue-400 py-3 rounded-sm">
                        <CardContent className="text-sky-900 text-sm pl-4">
                            {permissions.canManageMembers
                                ? 'You may add and remove members for your sports/culture CCA.'
                                : 'Member management is currently not available.'}
                        </CardContent>
                    </Card>
                )}

                {totalFilteredMembers === 0 && !isSportsCulture ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-gray-500 bg-gray-50 rounded-md">
                        <p className="text-lg mb-2">
                            📋 No members found for this CCA.
                        </p>
                        <p className="text-sm text-gray-400">
                            Members will appear here when they are appointed to positions in this CCA.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {renderMemberGroup('Leadership', leadershipMembers)}
                        {!isSportsCulture && renderMemberGroup('Main Committee', currentGroupedMembers.maincomm || [], true, false)}
                        {!isSportsCulture && renderMemberGroup('Sub Committee', currentGroupedMembers.subcomm || [], true, false)}
                        {isSportsCulture && renderMemberGroup('Team Manager', currentGroupedMembers.teamManager || [])}
                        
                        {isSportsCulture && renderMemberGroup('Final Cut - IHG Team Members (IVP)', currentGroupedMembers.ivpIhgTeam || [], true, false)}
                        {isSportsCulture && renderMemberGroup('Final Cut - IHG Team Members', currentGroupedMembers.ihgTeam || [], true, false)}
                        {isSportsCulture && renderMemberGroup('Final Cut Members', currentGroupedMembers.finalCut || [], true, false)}
                        
                        {renderMemberGroup('Members', currentGroupedMembers.members || [], true, true)}
                    </div>
                )}
                <Alert className="bg-blue-500/10 dark:bg-blue-600/20 text-blue-500 border-none">
                    <Volleyball className="size-4" />
                    <AlertTitle><strong>Total Members:</strong> {totalFilteredMembers}</AlertTitle>
                </Alert>


                {/* Add Member Modal */}
                {showAddMemberModal && isSportsCulture && (
                    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
                        <div className="bg-white p-6 rounded-xl w-[90%] max-w-[750px] max-h-[80vh] overflow-auto">
                            <h3 className="text-lg font-bold mb-4">Add Member</h3>
                            {selectedUser ? (
                                <div className="space-y-4">
                                    <div className="p-4 bg-gray-50 rounded-md">
                                        <p className="font-bold">{selectedUser.name}</p>
                                        <p className="text-sm text-gray-500">{selectedUser.email}</p>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Position</label>
                                        <select
                                            className="w-full border rounded p-2 bg-white"
                                            value={addForm.positionId}
                                            onChange={(e) => setAddForm({...addForm, positionId: Number(e.target.value)})}
                                        >
                                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                            {allPositions
                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                .filter((pos: any) => !['lead', 'vice'].includes(pos.position_type))
                                                .map((pos: any) => (
                                                <option key={pos.id} value={pos.id}>{pos.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Commitment Period</label>
                                        <select
                                            className="w-full border rounded p-2 bg-white"
                                            value={addForm.commitmentPeriod}
                                            onChange={(e) => setAddForm({...addForm, commitmentPeriod: e.target.value as CommitmentPeriod})}
                                        >
                                            <option value="full-year">Full Year</option>
                                            <option value="semester-1">Semester 1</option>
                                            <option value="semester-2">Semester 2</option>
                                        </select>
                                    </div>
                                    
                                    <div className="flex justify-end gap-2 mt-6">
                                        <Button 
                                            onClick={() => setSelectedUser(null)} 
                                            variant="outline"
                                            className="bg-gray-100 hover:bg-gray-200"
                                        >
                                            Back
                                        </Button>
                                        <Button 
                                            onClick={() => handleLocalAddMember(
                                                selectedUser.id, 
                                                selectedUser.name, 
                                                selectedUser.email, 
                                                selectedUser.room || undefined, 
                                                addForm.positionId, 
                                                (addForm.commitmentPeriod || 'full-year') as CommitmentPeriod
                                            )}
                                            className="bg-green-600 hover:bg-green-500 text-white"
                                        >
                                            Confirm Add
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex gap-4 mb-4">
                                        <Input
                                            type="text"
                                            placeholder="Search by name / email / room..."
                                            value={userSearchQuery}
                                            onChange={(e) => setUserSearchQuery(e.target.value)}
                                            onKeyPress={handleSearchKeyPress}
                                            className="focus-visible:ring-[2px] focus-visible:ring-blue-500/20 focus-visible:border-blue-500 py-5 rounded-sm border border-gray-300 w-full pl-4"
                                        />
                                        <Button
                                            onClick={handleSearchUsers}
                                            disabled={isSearching}
                                            className="bg-blue-500 text-white hover:bg-blue-400 px-8 py-3 shadow-md font-bold cursor-pointer"
                                        >
                                            {isSearching ? 'Searching...' : 'Search'}
                                        </Button>
                                    </div>

                                    {isSearching && (
                                        <div className="flex items-center justify-center mt-4">
                                            <LoadingSpinner message="Searching users..." fullHeight={false} />
                                        </div>
                                    )}

                                    <div className="mt-4">
                                        <div className="space-y-2 max-h-64 overflow-y-auto">
                                            {userSearchResults.map(user => (
                                                <div
                                                    key={user.id}
                                                    className="flex justify-between items-center p-3 border border-gray-200 rounded-md bg-white shadow-sm"
                                                >
                                                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                                                        <strong className="font-bold">{user.name}</strong>
                                                        <span className="text-gray-500">({user.email})</span>
                                                        {user.room && <span className="text-gray-400">- {user.room}</span>}
                                                    </div>

                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleUserButtonClick(user)}
                                                        className={isUserAdded(user.id)
                                                            ? "bg-red-500 text-white hover:bg-red-400 px-4 py-2 shadow-md font-bold cursor-pointer"
                                                            : "bg-green-500 text-white hover:bg-green-400 px-4 py-2 shadow-md font-bold cursor-pointer"
                                                        }
                                                    >
                                                        {getUserButtonText(user.id)}
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="mt-6 flex justify-end">
                                <Button
                                    onClick={() => {
                                        setShowAddMemberModal(false);
                                        setUserSearchQuery('');
                                        setUserSearchResults([]);
                                    }}
                                    className="bg-gray-500 text-white hover:bg-gray-400 px-6 py-4 shadow-md font-bold cursor-pointer"
                                >
                                    Close
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
                {/* Error Modal */}
                <Dialog open={saveErrors.length > 0} onOpenChange={(open) => !open && setSaveErrors([])}>
                    <DialogContent className="border-l-4 border-red-500 max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle className="text-red-600 flex items-center gap-2">
                                <AlertCircleIcon className="h-5 w-5" />
                                Errors Occurred
                            </DialogTitle>
                            <DialogDescription>
                                The following errors prevented some changes from being saved:
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2 my-4 max-h-60 overflow-y-auto">
                            {saveErrors.map((err, idx) => (
                                <div key={idx} className="p-3 bg-red-50 text-red-700 rounded-md text-sm border border-red-100 break-words">
                                    {err}
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-end">
                            <Button 
                                onClick={() => setSaveErrors([])}
                                className="bg-gray-800 text-white hover:bg-gray-700"
                            >
                                Close
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
                {saving && <LoadingSpinner message="Saving changes..." overlay />}
            </div>
        </AppLayout>
    );
}
