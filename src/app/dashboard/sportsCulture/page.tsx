// src/app/dashboard/sportsCulture/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/context/AuthContext';
import { usePhaseInfo } from '@/hooks/usePhaseInfo';
import toast from 'react-hot-toast';
import { GroupedPositions, SportsCulturePosition } from '@/types/dashboard';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
export default function SportsCulturePage() {
    const { user } = useAuth();
    const { phaseInfo } = usePhaseInfo();

    const [positions, setPositions] = useState<GroupedPositions>({ sports: [], culture: [] });
    const [loading, setLoading] = useState(true);
    const [applicationsOpen, setApplicationsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [pendingActions, setPendingActions] = useState<Set<number>>(new Set());

    useEffect(() => {
        fetchAvailablePositions();
    }, []);

    const fetchAvailablePositions = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/sportsCulture/available');

            if (!response.ok) {
                throw new Error('Failed to fetch positions');
            }

            const data = await response.json();
            setPositions(data.positions || { sports: [], culture: [] });
            setApplicationsOpen(data.applicationsOpen || false);
        } catch (error) {
            console.error('Error fetching positions:', error);
            toast.error('Failed to load positions');
        } finally {
            setLoading(false);
        }
    };

    const handleApplicationToggle = async (positionId: number, isCurrentlyApplied: boolean, canApply: boolean, conflictReason?: string) => {
        // Handle conflicts
        if (!canApply && !isCurrentlyApplied) {
            toast.error(conflictReason || 'Cannot apply to this position');
            return;
        }

        if (pendingActions.has(positionId)) return;

        setPendingActions(prev => new Set(prev).add(positionId));

        try {
            const url = '/api/sportsCulture/apply';
            const method = isCurrentlyApplied ? 'DELETE' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ position_id: positionId })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to ${isCurrentlyApplied ? 'remove' : 'submit'} application`);
            }

            // Refresh data to get updated state
            await fetchAvailablePositions();

            toast.success(isCurrentlyApplied ? 'Application removed successfully' : 'Application submitted successfully');
        } catch (error: any) {
            console.error('Error toggling application:', error);
            toast.error(error.message);
        } finally {
            setPendingActions(prev => {
                const updated = new Set(prev);
                updated.delete(positionId);
                return updated;
            });
        }
    };

    // Combine and sort all positions alphabetically
    const getAllPositions = () => {
        const allPositions = [...positions.sports, ...positions.culture];
        return allPositions.sort((a, b) => a.cca_name.localeCompare(b.cca_name));
    };

    const filterPositions = (positions: SportsCulturePosition[]) => {
        return positions.filter(pos =>
            pos.cca_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            pos.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (pos.description && pos.description.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    };

    const getStatusMessage = () => {
        if (!applicationsOpen) {
            return "Sports & Culture applications are currently closed.";
        }
        return phaseInfo.userMessage || "Applications are open!";
    };

    // Get button style based on position state
    const getButtonStyle = (position: SportsCulturePosition) => {
        if (!position.can_apply && !position.is_applied) {
            return styles.disabledButton;
        }
        return position.is_applied ? styles.removeButton : styles.applyButton;
    };

    // Get button text
    const getButtonText = (position: SportsCulturePosition, isPending: boolean) => {
        if (!position.can_apply && !position.is_applied) {
            if (position.user_current_role === 'lead') return 'Apply';
            if (position.user_current_role === 'vice') return 'Apply';
            if (position.user_current_role === 'member') return 'Apply';
            if (position.user_current_role === 'team manager') return 'Apply';
            return 'Cannot Apply';
        }

        if (isPending) {
            return position.is_applied ? 'Removing...' : 'Applying...';
        }

        return position.is_applied ? 'Remove Application' : 'Apply Now';
    };

    if (loading) {
        return (
            <div style={styles.container}>
                <Sidebar />
                <div style={styles.content}>
                    <LoadingSpinner message="Loading positions..." />
                </div>
            </div>
        );
    }

    if (!applicationsOpen) {
        return (
            <div style={styles.container}>
                <Sidebar />
                <div style={styles.content}>
                    <div style={styles.header}>
                        <h1 style={styles.title}>Sports & Culture Applications</h1>
                        <p style={styles.subtitle}>Apply to Sports & Culture CCAs during open application periods.</p>
                    </div>

                    <div style={styles.emptyState}>
                        <p>📅 {getStatusMessage()}</p>
                        {phaseInfo.nextPhaseDate && (
                            <p><strong>Next Update:</strong> {phaseInfo.nextPhaseDate}</p>
                        )}
                        <p style={styles.emptySubtext}>
                            Sports & Culture applications will open during the SubComm concurrent ranking phase.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const allPositions = getAllPositions();
    const filteredPositions = filterPositions(allPositions);
    const appliedCount = allPositions.filter(pos => pos.is_applied).length;
    const conflictCount = allPositions.filter(pos => !pos.can_apply && !pos.is_applied).length;

    return (
        <div style={styles.container}>
            <Sidebar />
            <div style={styles.content}>
                <div style={styles.header}>
                    <h1 style={styles.title}>Sports & Culture Applications</h1>
                    <p style={styles.subtitle}>Apply to Sports & Culture CCAs below.</p>
                </div>

                <div style={styles.instructionsBar}>
                    <span style={styles.instructionText}>
                        <strong>Your Applications:</strong> {appliedCount} of {allPositions.length} CCAs
                    </span>
                </div>

                <div style={styles.searchContainer}>
                    <input
                        type="text"
                        placeholder="Search CCAs by name or description..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={styles.searchInput}
                    />
                </div>

                {filteredPositions.length === 0 ? (
                    <div style={styles.emptyState}>
                        <p>📋 {searchTerm ? 'No CCAs found matching your search.' : 'No CCAs available.'}</p>
                        {searchTerm && (
                            <p>Try adjusting your search terms.</p>
                        )}
                    </div>
                ) : (
                    <div style={styles.positionContainer}>
                        {filteredPositions.map((position) => (
                            <div
                                key={position.id}
                                style={{
                                    ...styles.positionCard,
                                    ...((!position.can_apply && !position.is_applied) ? styles.disabledCard : {})
                                }}
                                title={position.conflict_reason || undefined}
                            >
                                <div style={styles.positionInfo}>
                                    <div style={styles.positionHeader}>
                                        <h3 style={styles.positionName}>{position.cca_name}</h3>
                                    </div>
                                    <p style={styles.ccaName}>Position: {position.name}</p>
                                    <div style={styles.positionMeta}>
                                        <span style={styles.positionType}>
                                            {position.cca_type.charAt(0).toUpperCase() + position.cca_type.slice(1)}
                                        </span>
                                        {position.capacity && (
                                            <span style={styles.capacity}>
                                                Available Capacity: {position.capacity}
                                            </span>
                                        )}
                                    </div>
                                    {position.description && (
                                        <p style={styles.description}>{position.description}</p>
                                    )}
                                </div>

                                <div style={styles.controls}>
                                    <button
                                        onClick={() => handleApplicationToggle(
                                            position.id,
                                            position.is_applied,
                                            position.can_apply,
                                            position.conflict_reason
                                        )}
                                        disabled={pendingActions.has(position.id) || (!position.can_apply && !position.is_applied)}
                                        style={getButtonStyle(position)}
                                        title={position.conflict_reason || undefined}
                                    >
                                        {getButtonText(position, pendingActions.has(position.id))}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {pendingActions.size > 0 && <LoadingSpinner message="Processing application..." overlay />}
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
    title: {
        fontSize: '28px',
        marginBottom: '10px',
        fontWeight: 'bold',
        color: '#4A4A4A'
    },
    subtitle: {
        fontSize: '14px',
        color: '#7A7A7A',
        margin: '0'
    },
    loading: {
        textAlign: 'center' as const,
        fontSize: '16px',
        color: '#7A7A7A',
        marginTop: '50px'
    },
    emptyState: {
        textAlign: 'center' as const,
        padding: '50px 20px',
        color: '#7A7A7A',
        backgroundColor: '#F8F9FA',
        borderRadius: '8px',
        border: '2px dashed #E5E7EB'
    },
    emptySubtext: {
        color: '#6B7280',
        fontSize: '14px',
        marginTop: '8px',
    },
    instructionsBar: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        padding: '15px',
        backgroundColor: '#F8F9FA',
        borderRadius: '8px'
    },
    instructionText: {
        fontSize: '14px',
        color: '#6B7280'
    },
    conflictText: {
        color: '#EF4444',
        fontSize: '12px'
    },
    searchContainer: {
        marginBottom: '20px',
    },
    searchInput: {
        width: '100%',
        padding: '12px 16px',
        border: '1px solid #D1D5DB',
        borderRadius: '8px',
        fontSize: '16px',
        outline: 'none',
        boxSizing: 'border-box' as const
    },
    positionContainer: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '12px'
    },
    positionCard: {
        display: 'flex',
        alignItems: 'center',
        padding: '20px',
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        transition: 'all 0.2s ease'
    },
    disabledCard: {
        backgroundColor: '#F9FAFB',
        border: '1px solid #E5E7EB',
        opacity: 0.7
    },
    positionInfo: {
        flex: 1,
        marginRight: '20px'
    },
    positionHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '5px'
    },
    positionName: {
        fontSize: '18px',
        fontWeight: 'bold',
        color: '#1F2937',
        margin: '0'
    },
    roleTag: {
        fontSize: '11px',
        padding: '2px 6px',
        backgroundColor: '#FEF3C7',
        color: '#92400E',
        borderRadius: '4px',
        fontWeight: 'bold',
        border: '1px solid #FBBF24'
    },
    ccaName: {
        fontSize: '16px',
        color: '#4B5563',
        margin: '0 0 10px 0'
    },
    positionMeta: {
        display: 'flex',
        gap: '15px',
        marginBottom: '8px'
    },
    positionType: {
        fontSize: '12px',
        padding: '4px 8px',
        backgroundColor: '#EFF6FF',
        color: '#1D4ED8',
        borderRadius: '4px',
        fontWeight: 'bold'
    },
    capacity: {
        fontSize: '12px',
        color: '#6B7280',
        alignSelf: 'center'
    },
    description: {
        fontSize: '13px',
        color: '#6B7280',
        margin: '0 0 8px 0'
    },
    conflictMessage: {
        fontSize: '12px',
        color: '#EF4444',
        backgroundColor: '#FEF2F2',
        padding: '6px 8px',
        borderRadius: '4px',
        border: '1px solid #FECACA',
        margin: '0'
    },
    controls: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '8px'
    },
    applyButton: {
        backgroundColor: '#10B981',
        color: 'white',
        padding: '10px 20px',
        borderRadius: '6px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
        transition: 'all 0.2s ease',
        minWidth: '140px'
    },
    removeButton: {
        backgroundColor: '#EF4444',
        color: 'white',
        padding: '10px 20px',
        borderRadius: '6px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
        transition: 'all 0.2s ease',
        minWidth: '140px'
    },
    disabledButton: {
        backgroundColor: '#E5E7EB',
        color: '#9CA3AF',
        padding: '10px 20px',
        borderRadius: '6px',
        border: 'none',
        cursor: 'not-allowed',
        fontSize: '14px',
        fontWeight: 'bold',
        minWidth: '140px'
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
    loadingText: {
        fontSize: '16px',
        fontWeight: 'bold',
        color: '#4A4A4A',
        margin: 0
    }
};
