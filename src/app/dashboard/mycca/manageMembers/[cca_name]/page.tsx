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

interface GroupedMembers {
    lead: Member[];
    vice: Member[];
    maincomm: Member[];
    subcomm: Member[];
}

interface CCAInfo {
    id: number;
    name: string;
}

export default function ManageMembersPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();

    const ccaName = decodeURIComponent(params.cca_name as string);

    const [groupedMembers, setGroupedMembers] = useState<GroupedMembers>({
        lead: [],
        vice: [],
        maincomm: [],
        subcomm: []
    });
    const [cca, setCCA] = useState<CCAInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [totalMembers, setTotalMembers] = useState(0);

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
            setGroupedMembers(data.groupedMembers || {
                lead: [],
                vice: [],
                maincomm: [],
                subcomm: []
            });
            setCCA(data.cca);
            setTotalMembers(data.total_members || 0);
            setError(null);
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

    // Filter members based on search term
    const filterMembers = (members: Member[]) => {
        return members.filter(member =>
            member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            member.room.toLowerCase().includes(searchTerm.toLowerCase()) ||
            member.position_name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    };

    const filteredGroupedMembers = {
        lead: filterMembers(groupedMembers.lead),
        vice: filterMembers(groupedMembers.vice),
        maincomm: filterMembers(groupedMembers.maincomm),
        subcomm: filterMembers(groupedMembers.subcomm)
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

    const renderMemberGroup = (title: string, members: Member[]) => {
        if (members.length === 0) return null;

        return (
            <div style={styles.groupSection}>
                <h3 style={styles.groupTitle}>{title}</h3>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Name</th>
                            <th style={styles.th}>Email</th>
                            <th style={styles.th}>Room</th>
                            <th style={styles.th}>Position</th>
                        </tr>
                    </thead>
                    <tbody>
                        {members.map((member, index) => (
                            <tr key={member.user_id} style={index % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                                <td style={styles.td}>{member.name}</td>
                                <td style={styles.td}>{member.email}</td>
                                <td style={styles.td}>{member.room}</td>
                                <td style={styles.td}>{member.position_name}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const leadershipMembers = [...filteredGroupedMembers.lead, ...filteredGroupedMembers.vice];

    return (
        <div style={styles.container}>
            <Sidebar />
            <div style={styles.content}>
                <div style={styles.header}>
                    <div style={styles.titleRow}>
                        <h1 style={styles.title}>CCA Members - {cca?.name}</h1>
                        <button
                            onClick={() => router.push('/dashboard/mycca')}
                            style={styles.backButton}
                        >
                            ← Back to My CCAs
                        </button>
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
                </div>

                {totalFilteredMembers === 0 ? (
                    <div style={styles.emptyState}>
                        <p>📋 {searchTerm ? 'No members found matching your search.' : 'No members found for this CCA.'}</p>
                        <p style={styles.emptySubtext}>
                            {searchTerm ? 'Try adjusting your search terms.' : 'Members will appear here when they are appointed to positions in this CCA.'}
                        </p>
                    </div>
                ) : (
                    <div style={styles.tableContainer}>
                        {renderMemberGroup('Leadership', leadershipMembers)}
                        {renderMemberGroup('Main Committee', filteredGroupedMembers.maincomm)}
                        {renderMemberGroup('Sub Committee', filteredGroupedMembers.subcomm)}
                    </div>
                )}

                <div style={styles.footer}>
                    <p><strong>Total Members:</strong> {totalFilteredMembers}</p>
                    {searchTerm && (
                        <p><strong>Showing:</strong> {totalFilteredMembers} of {totalMembers} members</p>
                    )}
                </div>
            </div>
        </div>
    );
}

const styles = {
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
        marginBottom: '20px'
    },
    searchInput: {
        padding: '10px 16px',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        width: '100%',
        maxWidth: '400px',
        fontSize: '14px',
        backgroundColor: '#FFFFFF',
        color: '#1F2937'
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
        marginBottom: '40px'
    },
    groupTitle: {
        fontSize: '16px',
        fontWeight: 'bold',
        marginBottom: '15px',
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
    }
};
