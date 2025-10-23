// src/app/dashboard/mycca/manageMembers/[cca_name]/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

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
        <div style={styles.loadingOverlay}>
            <div style={styles.loadingContent}>
                <div style={styles.spinner}></div>
                <p style={styles.loadingText}>Saving rankings...</p>
            </div>
        </div>
    );
}

export default function ManageMembersPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();

    const ccaName = decodeURIComponent(params.cca_name as string);

    // Original state
    const [originalGroupedMembers, setOriginalGroupedMembers] = useState<any>({});
    const [currentGroupedMembers, setCurrentGroupedMembers] = useState<any>({});

    // UI state
    const [cca, setCCA] = useState<any>(null);
    const [permissions, setPermissions] = useState<any>({ canManageMembers: false, ccaType: '' });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
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

    // Filter members for display
    const filterMembers = (members: Member[]) => {
        return members.filter(member =>
            member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            member.room.toLowerCase().includes(searchTerm.toLowerCase()) ||
            member.position_name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    };

    const filteredGroupedMembers = {
        lead: filterMembers(currentGroupedMembers.lead || []),
        vice: filterMembers(currentGroupedMembers.vice || []),
        maincomm: filterMembers(currentGroupedMembers.maincomm || []),
        subcomm: filterMembers(currentGroupedMembers.subcomm || []),
        teamManager: filterMembers(currentGroupedMembers.teamManager || []),
        members: filterMembers(currentGroupedMembers.members || [])
    };

    const totalFilteredMembers = Object.values(filteredGroupedMembers).flat().length;

    if (loading) {
        return (
            <div style={styles.container}>
                <Sidebar />
                <div style={styles.content}>
                    <div style={styles.loading}>Loading members...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={styles.container}>
                <Sidebar />
                <div style={styles.content}>
                    <div style={styles.header}>
                        <h1 style={styles.title}>CCA Members</h1>
                    </div>
                    <div style={styles.error}>
                        <p>⚠️ {error}</p>
                        <button onClick={() => router.push('/dashboard/mycca')} style={styles.retryButton}>
                            Back to My CCAs
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const renderMemberGroup = (title: string, members: Member[], showManagementActions: boolean = false) => {
        if (members.length === 0 && !showManagementActions) return null;

        return (
            <div style={styles.groupSection}>
                <div style={styles.groupHeader}>
                    <h3 style={styles.groupTitle}>{title}</h3>
                    {showManagementActions && permissions.canManageMembers && ['sports', 'culture'].includes(permissions.ccaType) && (
                        <button
                            onClick={() => setShowAddMemberModal(true)}
                            style={styles.addButton}
                        >
                            + Add Member
                        </button>
                    )}
                </div>

                {members.length === 0 ? (
                    showManagementActions && (
                        <div style={styles.emptySection}>
                            <p>No {title.toLowerCase()} found.</p>
                        </div>
                    )
                ) : (
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Name</th>
                                <th style={styles.th}>Email</th>
                                <th style={styles.th}>Room</th>
                                <th style={styles.th}>Position</th>
                                {showManagementActions && permissions.canManageMembers && ['sports', 'culture'].includes(permissions.ccaType) && (
                                    <th style={styles.th}>Actions</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {members.map((member, index) => (
                                <tr key={member.user_id} style={index % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                                    <td style={styles.td}>{member.name}</td>
                                    <td style={styles.td}>{member.email}</td>
                                    <td style={styles.td}>{member.room}</td>
                                    <td style={styles.td}>{member.position_name}</td>
                                    {showManagementActions && permissions.canManageMembers && ['sports', 'culture'].includes(permissions.ccaType) && (
                                        <td style={styles.td}>
                                            <button
                                                onClick={() => handleLocalRemoveMember(member.user_id, member.name)}
                                                style={styles.removeButton}
                                            >
                                                Remove
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        );
    };

    const leadershipMembers = [...filteredGroupedMembers.lead, ...filteredGroupedMembers.vice];
    const isSportsCulture = ['sports', 'culture'].includes(permissions.ccaType);

    return (
        <div style={styles.container}>
            <Sidebar />
            <div style={styles.content}>
                <div style={styles.header}>
                    <div style={styles.titleRow}>
                        <h1 style={styles.title}>CCA Members - {cca?.name}</h1>
                        <div style={styles.headerActions}>
                            {pendingChanges.length > 0 && (
                                <button
                                    onClick={handleSaveMembers}
                                    disabled={saving}
                                    style={styles.saveButton}
                                >
                                    {saving ? 'Saving...' : `Save Members (${pendingChanges.length})`}
                                </button>
                            )}
                            <button
                                onClick={() => router.push('/dashboard/mycca')}
                                style={styles.backButton}
                            >
                                ← Back to My CCAs
                            </button>
                        </div>
                    </div>

                    <div style={styles.searchContainer}>
                        <input
                            type="text"
                            placeholder="Search members by name, email, room, or position..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={styles.searchInput}
                        />
                    </div>

                    {pendingChanges.length > 0 && (
                        <div style={styles.pendingChanges}>
                            <p style={styles.pendingText}>
                                <strong>{pendingChanges.length}</strong> pending changes. Click "Save Members" to apply.
                            </p>
                        </div>
                    )}

                    {isSportsCulture && (
                        <div style={styles.managementInfo}>
                            <p style={styles.managementText}>
                                {permissions.canManageMembers
                                    ? 'You may add and remove members for your sports/culture CCA.'
                                    : 'Member management is not currently available.'}
                            </p>
                        </div>
                    )}
                </div>

                {totalFilteredMembers === 0 && !isSportsCulture ? (
                    <div style={styles.emptyState}>
                        <p>📋 {searchTerm ? 'No members found matching your search.' : 'No members found for this CCA.'}</p>
                        <p style={styles.emptySubtext}>
                            {searchTerm ? 'Try adjusting your search terms.' : 'Members will appear here when they are appointed to positions in this CCA.'}
                        </p>
                    </div>
                ) : (
                    <div style={styles.tableContainer}>
                        {renderMemberGroup('Leadership', leadershipMembers)}
                        {!isSportsCulture && renderMemberGroup('Main Committee', filteredGroupedMembers.maincomm)}
                        {!isSportsCulture && renderMemberGroup('Sub Committee', filteredGroupedMembers.subcomm)}
                        {isSportsCulture && renderMemberGroup('Team Manager', filteredGroupedMembers.teamManager)}
                        {isSportsCulture && renderMemberGroup('Members', filteredGroupedMembers.members, true)}
                    </div>
                )}

                <div style={styles.footer}>
                    <p><strong>Total Members:</strong> {totalFilteredMembers}</p>
                    {searchTerm && (
                        <p><strong>Showing:</strong> {totalFilteredMembers} of {totalMembers} members</p>
                    )}
                </div>
            </div>

            {/* Add Member Modal */}
            {showAddMemberModal && (
                <div style={styles.modal}>
                    <div style={styles.modalContent}>
                        <h3 style={styles.modalTitle}>Add Member</h3>

                        <div style={styles.searchContainer}>
                            <input
                                type="text"
                                placeholder="Search by name / email / room..."
                                value={userSearchQuery}
                                onChange={(e) => setUserSearchQuery(e.target.value)}
                                onKeyPress={handleSearchKeyPress}
                                style={styles.modalInput}
                            />
                            <button
                                onClick={handleSearchUsers}
                                disabled={isSearching}
                                style={styles.searchButton}
                            >
                                {isSearching ? 'Searching...' : 'Search'}
                            </button>
                        </div>

                        {isSearching && <p style={styles.searchingText}>Searching...</p>}

                        <div style={styles.searchResults}>
                            {userSearchResults.map(user => (
                                <div key={user.id} style={styles.userResult}>
                                    <div style={styles.userInfo}>
                                        <strong style={styles.userName}>{user.name}</strong>
                                        <span style={styles.userEmail}>({user.email})</span>
                                        {user.room && <span style={styles.userRoom}> - {user.room}</span>}
                                    </div>
                                    <button
                                        onClick={() => handleUserButtonClick(user)}
                                        style={isUserAdded(user.id) ? styles.removeUserButton : styles.addUserButton}
                                    >
                                        {getUserButtonText(user.id)}
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div style={styles.modalActions}>
                            <button
                                onClick={() => {
                                    setShowAddMemberModal(false);
                                    setUserSearchQuery('');
                                    setUserSearchResults([]);
                                }}
                                style={styles.cancelButton}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <LoadingOverlay visible={saving || loading} />
        </div>
    );
}

const styles = {
    headerActions: {
        display: 'flex',
        gap: '12px',
        alignItems: 'center'
    },
    saveButton: {
        padding: '10px 20px',
        backgroundColor: '#10B981',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold'
    },
    pendingChanges: {
        padding: '12px 16px',
        backgroundColor: '#FFF3CD',
        border: '1px solid #FFEAA7',
        borderRadius: '8px',
        marginBottom: '20px'
    },
    pendingText: {
        margin: 0,
        fontSize: '14px',
        color: '#856404'
    },
    removeUserButton: {
        padding: '6px 12px',
        backgroundColor: '#EF4444',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '12px'
    },
    container: {
        display: 'flex',
        height: '100vh',
        fontFamily: 'Arial, sans-serif'
    },
    content: {
        flex: 1,
        padding: '20px',
        backgroundColor: '#FFFFFF',
        color: '#2C2C2C',
        overflow: 'auto'
    },
    header: {
        marginBottom: '30px'
    },
    titleRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
    },
    title: {
        fontSize: '28px',
        marginBottom: '10px',
        fontWeight: 'bold',
        color: '#4A4A4A'
    },
    backButton: {
        padding: '10px 20px',
        backgroundColor: '#3B82F6',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold'
    },
    searchContainer: {
        display: 'flex',
        gap: '12px',
        marginBottom: '20px'
    },
    searchInput: {
        padding: '10px 16px',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        flex: 1,
        fontSize: '14px',
        backgroundColor: '#FFFFFF',
        color: '#1F2937'
    },
    searchButton: {
        padding: '10px 20px',
        backgroundColor: '#3B82F6',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
        minWidth: '100px'
    },
    managementInfo: {
        padding: '12px 16px',
        backgroundColor: '#F0F9FF',
        border: '1px solid #0EA5E9',
        borderRadius: '8px',
        marginBottom: '20px'
    },
    managementText: {
        margin: 0,
        fontSize: '14px',
        color: '#0C4A6E'
    },
    groupHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '15px'
    },
    addButton: {
        padding: '8px 16px',
        backgroundColor: '#10B981',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold'
    },
    removeButton: {
        padding: '6px 12px',
        backgroundColor: '#EF4444',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '12px'
    },
    emptySection: {
        padding: '20px',
        textAlign: 'center' as const,
        color: '#6B7280',
        fontStyle: 'italic'
    },
    modal: {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
    },
    modalContent: {
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '750px',
        maxHeight: '80vh',
        overflow: 'auto'
    },
    modalTitle: {
        fontSize: '20px',
        fontWeight: 'bold',
        marginBottom: '16px',
        color: '#1F2937'
    },
    modalInput: {
        padding: '10px 16px',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        flex: 1,
        fontSize: '14px',
        color: '#1F2937',
        backgroundColor: '#FFFFFF'
    },
    searchingText: {
        fontSize: '14px',
        color: '#6B7280',
        fontStyle: 'italic',
        textAlign: 'center' as const
    },
    searchResults: {
        maxHeight: '300px',
        overflow: 'auto',
        marginBottom: '20px'
    },
    userResult: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        marginBottom: '8px',
        backgroundColor: '#F9FAFB'
    },
    userInfo: {
        flex: 1,
        color: '#1F2937' // ✅ FIXED: Black text
    },
    // ✅ FIXED: Separate styles for different text elements
    userName: {
        color: '#1F2937', // Black for name
        fontWeight: 'bold'
    },
    userEmail: {
        color: '#1F2937' // Black for email
    },
    userRoom: {
        color: '#6B7280', // Keep grey for room (subtle info)
        fontSize: '14px'
    },
    addUserButton: {
        padding: '6px 12px',
        backgroundColor: '#10B981',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '12px'
    },
    modalActions: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '12px'
    },
    cancelButton: {
        padding: '10px 20px',
        backgroundColor: '#6B7280',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px'
    },
    loading: {
        textAlign: 'center' as const,
        fontSize: '16px',
        color: '#7A7A7A',
        marginTop: '50px',
        padding: '20px'
    },
    error: {
        textAlign: 'center' as const,
        padding: '50px 20px',
        color: '#B91C1C',
        backgroundColor: '#FEF2F2',
        borderRadius: '8px',
        border: '1px solid #FCA5A5'
    },
    retryButton: {
        marginTop: '15px',
        padding: '10px 20px',
        backgroundColor: '#3B82F6',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px'
    },
    emptyState: {
        textAlign: 'center' as const,
        padding: '60px 20px',
        color: '#6B7280',
        backgroundColor: '#F9FAFB',
        borderRadius: '8px',
        border: '2px dashed #E5E7EB'
    },
    emptySubtext: {
        fontSize: '14px',
        marginTop: '10px',
        color: '#9CA3AF'
    },
    tableContainer: {
        marginBottom: '20px'
    },
    groupSection: {
        marginBottom: '20px'
    },
    groupTitle: {
        fontSize: '16px',
        fontWeight: 'bold',
        color: '#1F2937',
        borderBottom: '2px solid #E5E7EB',
        paddingBottom: '8px'
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse' as const,
        marginTop: '10px',
        backgroundColor: '#FFFFFF',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
    },
    th: {
        textAlign: 'left' as const,
        borderBottom: '2px solid #E5E7EB',
        padding: '15px 12px',
        backgroundColor: '#F9FAFB',
        fontSize: '14px',
        fontWeight: 'bold',
        color: '#374151'
    },
    td: {
        borderBottom: '1px solid #E5E7EB',
        padding: '15px 12px',
        fontSize: '14px',
        color: '#1F2937'
    },
    rowEven: {
        backgroundColor: '#F9FAFB'
    },
    rowOdd: {
        backgroundColor: '#FFFFFF'
    },
    footer: {
        marginTop: '20px',
        padding: '15px',
        textAlign: 'center' as const,
        fontSize: '14px',
        color: '#1F2937',
        backgroundColor: '#F8F9FA',
        borderRadius: '6px'
    },
    loadingOverlay: {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999
    },
    loadingContent: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        padding: '30px',
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
    },
    spinner: {
        width: '50px',
        height: '50px',
        border: '6px solid #f3f3f3',
        borderTop: '6px solid #10B981',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: '15px'
    },
    loadingText: {
        fontSize: '16px',
        fontWeight: 'bold',
        color: '#4A4A4A',
        margin: 0
    }
};
