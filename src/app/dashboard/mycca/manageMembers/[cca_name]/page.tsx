// src/app/dashboard/mycca/manageMembers/[cca_name]/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import { AppLayout } from '@/components/layout/app-layout';

// shadcn UI
import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner"
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircleIcon, Volleyball } from "lucide-react";

// Custom table component
import { SimpleTable, SimpleTableColumn } from "@/components/table/simple-table";
import Link from 'next/link';

interface Member {
    user_id: number;
    name: string;
    email: string;
    room: string;
    position_name: string;
    position_type: string;
    points: number;
    appointed_date: string;
}

interface PendingChange {
    type: 'add' | 'remove';
    user_id: number;
    user_name: string;
    user_email: string;
    user_room?: string;
}

interface UserSearchResult {
    id: number;
    name: string;
    email: string;
    room?: string | null;
}

function LoadingOverlay({ visible }: { visible: boolean }) {
    if (!visible) return null;

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50">
            <Item className="bg-white rounded-lg p-6 shadow-lg">
                <ItemMedia>
                    <Spinner className="w-12 h-12 text-green-500" />
                </ItemMedia>
                <ItemContent>
                    <ItemTitle className="text-gray-700 font-semibold">
                        Saving rankings...
                    </ItemTitle>
                </ItemContent>
            </Item>
        </div>
    );
}

function LoadingMembers() {
    return (
        <div className="flex items-center justify-center z-50">
            <Item className="bg-white rounded-lg p-6">
                <ItemMedia>
                    <Spinner className="w-8 h-8" />
                </ItemMedia>
                <ItemContent>
                    <ItemTitle className="text-gray-700 font-semibold">
                        Loading members...
                    </ItemTitle>
                </ItemContent>
            </Item>
        </div>
    );
}

// Define member table columns
const memberTableColumns: SimpleTableColumn<Member>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'room', header: 'Room' },
    { accessorKey: 'position_name', header: 'Position' },
];

export default function ManageMembersPage() {
    const params = useParams();
    const router = useRouter();

    const ccaName = decodeURIComponent(params.cca_name as string);

    // Original state
    const [originalGroupedMembers, setOriginalGroupedMembers] = useState<any>({});
    const [currentGroupedMembers, setCurrentGroupedMembers] = useState<any>({});

    // UI state
    const [cca, setCCA] = useState<any>(null);
    const [permissions, setPermissions] = useState<any>({ canManageMembers: false, ccaType: '' });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [totalMembers, setTotalMembers] = useState(0);
    const [saving, setSaving] = useState(false);

    // Modal state
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Pending changes
    const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);

    useEffect(() => {
        fetchMembers();
    }, [ccaName]);

    const fetchMembers = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/cca/${encodeURIComponent(ccaName)}/members`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch members');
            }

            const data = await response.json();
            setOriginalGroupedMembers(data.groupedMembers || {});
            setCurrentGroupedMembers(data.groupedMembers || {});
            setCCA(data.cca);
            setPermissions(data.permissions || { canManageMembers: false, ccaType: '' });
            setTotalMembers(data.total_members || 0);
            setError(null);
            setPendingChanges([]); // Reset pending changes
        } catch (error: any) {
            console.error('Error fetching members:', error);
            setError(error.message);
            if (error.message.includes('Unauthorized')) {
                toast.error('You are not authorized to manage this CCA');
                router.push('/dashboard/mycca');
            } else {
                toast.error('Failed to load members');
            }
        } finally {
            setLoading(false);
        }
    };

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
    const handleLocalAddMember = (userId: number, userName: string, userEmail: string, userRoom?: string) => {
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
            user_room: userRoom || ''
        };

        setPendingChanges(prev => [...prev, newChange]);

        // Add to current members display (for immediate UI feedback)
        const newMember: Member = {
            user_id: userId,
            name: userName,
            email: userEmail,
            room: userRoom || '',
            position_name: 'Member',
            position_type: 'member',
            points: 0,
            appointed_date: new Date().toISOString()
        };

        setCurrentGroupedMembers((prev: any) => ({
            ...prev,
            members: [...(prev.members || []), newMember]
        }));

        toast.success(`${userName} added to pending changes`);

        // Clear search
        setUserSearchQuery('');
        setUserSearchResults([]);
    };

    // Local remove member
    const handleLocalRemoveMember = (userId: number, memberName: string) => {
        // Remove from pending adds if exists
        setPendingChanges(prev => prev.filter(change =>
            !(change.type === 'add' && change.user_id === userId)
        ));

        // Check if this is an original member (needs API removal)
        const allOriginalMembers = Object.values(originalGroupedMembers).flat() as Member[];
        const isOriginalMember = allOriginalMembers.some(member => member.user_id === userId);

        if (isOriginalMember) {
            // Add to pending removes
            const newChange: PendingChange = {
                type: 'remove',
                user_id: userId,
                user_name: memberName,
                user_email: ''
            };
            setPendingChanges(prev => [...prev, newChange]);
        }

        // Remove from current display
        setCurrentGroupedMembers((prev: any) => {
            const updated = { ...prev };
            Object.keys(updated).forEach(key => {
                updated[key] = updated[key].filter((member: Member) => member.user_id !== userId);
            });
            return updated;
        });

        toast.success(`${memberName} marked for removal`);
    };

    // Save all pending changes
    const handleSaveMembers = async () => {
        if (pendingChanges.length === 0) {
            toast.error('No changes to save');
            return;
        }

        setSaving(true);
        let successCount = 0;
        let errorCount = 0;

        try {
            for (const change of pendingChanges) {
                try {
                    if (change.type === 'add') {
                        const response = await fetch(`/api/cca/${encodeURIComponent(ccaName)}/addMember`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                user_id: change.user_id,
                                reason: 'Added by lead/vice'
                            })
                        });

                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || 'Failed to add member');
                        }
                        successCount++;
                    } else if (change.type === 'remove') {
                        const response = await fetch(`/api/cca/${encodeURIComponent(ccaName)}/removeMember`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                user_id: change.user_id,
                                reason: 'Removed by lead/vice'
                            })
                        });

                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || 'Failed to remove member');
                        }
                        successCount++;
                    }
                } catch (error: any) {
                    console.error(`Error processing ${change.type} for ${change.user_name}:`, error);
                    errorCount++;
                }
            }

            if (successCount > 0) {
                toast.success(`Successfully processed ${successCount} changes`);
            }
            if (errorCount > 0) {
                toast.error(`Failed to process ${errorCount} changes`);
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

    // Handle user button click in search results
    const handleUserButtonClick = (user: UserSearchResult) => {
        if (isUserAdded(user.id)) {
            handleLocalRemoveMember(user.id, user.name);
        } else {
            handleLocalAddMember(user.id, user.name, user.email, user.room || '');
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen">
                <Sidebar />
                <div className="flex-1 p-6 bg-white overflow-auto flex justify-center items-center">
                    <LoadingMembers />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-full">
                <Sidebar />
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
                                onClick={() => router.push("/dashboard/mycca")}
                            >
                                Back to My CCAs
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    const renderMemberGroup = (
        title: string,
        members: Member[],
        showManagementActions: boolean = false
    ) => {
        if (members.length === 0 && !showManagementActions) return null;

        const canManage =
            showManagementActions &&
            permissions.canManageMembers &&
            ["sports", "culture"].includes(permissions.ccaType);

        // Build columns based on whether we can manage
        const columnsToUse: SimpleTableColumn<Member>[] = canManage
            ? [
                ...memberTableColumns,
                {
                    accessorKey: 'actions' as keyof Member,
                    header: 'Actions',
                    cell: (_value, row) => (
                        <Button
                            size="sm"
                            onClick={() => handleLocalRemoveMember(row.user_id, row.name)}
                            className="bg-red-500 text-white hover:bg-red-400 px-4 py-2 shadow-md font-bold cursor-pointer"
                        >
                            Remove
                        </Button>
                    ),
                },
            ]
            : memberTableColumns;

        return (
            <div className="mb-8">
                {/* Group Header */}
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">{title}</h3>
                    {canManage && (
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
                        <Link href="/dashboard/mycca">
                            <Button
                                size="lg"
                                className="bg-blue-500 text-white hover:bg-blue-400 px-6 py-4 shadow-md font-bold cursor-pointer"
                            >
                                ← Back to My CCAs
                            </Button>
                        </Link>
                    </div>
                </div>

                {pendingChanges.length > 0 && (
                    <Alert className="mb-4 bg-yellow-50 border-amber-600 py-3 rounded-sm">
                        <AlertCircleIcon color="#a96800" />
                        <AlertDescription className="text-yellow-700 ml-1">
                            <span>
                                <strong>{pendingChanges.length}</strong> pending changes. Click "Save Members" to apply.
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
                        {!isSportsCulture && renderMemberGroup('Main Committee', currentGroupedMembers.maincomm || [])}
                        {!isSportsCulture && renderMemberGroup('Sub Committee', currentGroupedMembers.subcomm || [])}
                        {isSportsCulture && renderMemberGroup('Team Manager', currentGroupedMembers.teamManager || [])}
                        {isSportsCulture && renderMemberGroup('Members', currentGroupedMembers.members || [], true)}
                    </div>
                )}
                <Alert className="bg-blue-500/10 dark:bg-blue-600/20 text-blue-500 border-none">
                    <Volleyball className="size-4" />
                    <AlertTitle><strong>Total Members:</strong> {totalFilteredMembers}</AlertTitle>
                </Alert>


                {/* Add Member Modal */}
                {showAddMemberModal && (
                    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
                        <div className="bg-white p-6 rounded-xl w-[90%] max-w-[750px] max-h-[80vh] overflow-auto">
                            <h3 className="text-lg font-bold mb-4">Add Member</h3>
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
                                <div className="flex items-center gap-2 text-gray-500 mt-2 justify-center">
                                    <Spinner className="w-5 h-5 animate-spin" />
                                    <p>Searching...</p>
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
                <LoadingOverlay visible={saving || loading} />
            </div>
        </AppLayout>
    );
}
