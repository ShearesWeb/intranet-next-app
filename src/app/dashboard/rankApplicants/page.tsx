// C:\Ron\intranet-next-app\src\app\dashboard\rankApplicants\page.tsx
'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

// Types (unchanged)
interface Applicant {
    id: number;
    name: string;
    email: string;
    room: string;
    ranking: number | null;
}

interface Position {
    id: number;
    name: string;
    cca_name: string;
    capacity: number;
    position_type: string;
    applicants: Applicant[];
}

interface UserSearchResult {
    id: number;
    name: string;
    email: string;
    room?: string | null;
}

interface PositionSearchBoxProps {
    positionId: number;
    onAddApplicant: (userId: number) => void;
}

// NEW: Loading Overlay Component
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

// PositionSearchBox component (unchanged)
function PositionSearchBox({ positionId, onAddApplicant }: PositionSearchBoxProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
    const [isUserFocused, setIsUserFocused] = useState(false);
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsUserFocused(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleFocus = useCallback(() => {
        setIsUserFocused(true);
    }, []);

    const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
        if (isUserFocused && !e.relatedTarget) {
            setTimeout(() => {
                if (inputRef.current && isUserFocused) {
                    inputRef.current.focus();
                }
            }, 10);
        }
    }, [isUserFocused]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (query.length < 2) {
            setSearchResults([]);
            return;
        }

        searchTimeoutRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/user/search?query=${encodeURIComponent(query)}`);
                if (!res.ok) {
                    throw new Error(`HTTP error: ${res.status}`);
                }
                const data = await res.json();
                setSearchResults(data.users || []);
            } catch (error) {
                console.error('Search error:', error);
                setSearchResults([]);
            }
        }, 300);
    }, []);

    const handleResultClick = useCallback((userId: number) => {
        onAddApplicant(userId);
        if (inputRef.current) {
            inputRef.current.value = '';
            inputRef.current.focus();
        }
        setSearchResults([]);
    }, [onAddApplicant]);

    return (
        <div ref={containerRef} style={styles.searchContainer}>
            <input
                ref={inputRef}
                style={styles.searchInput}
                type="text"
                placeholder="Search user by name/email/room..."
                onChange={handleInputChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                autoComplete="off"
            />

            {searchResults.length > 0 && (
                <div
                    style={styles.searchResultsContainer}
                    data-search-results="true"
                >
                    {searchResults.map(user => (
                        <div
                            key={user.id}
                            style={styles.searchResultItem}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleResultClick(user.id)}
                        >
                            {user.name} ({user.email}{user.room ? `, Room ${user.room}` : ''})
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// PositionCard component (unchanged)
function PositionCard(props: {
    position: Position;
    positionIndex: number;
    saving: boolean;
    hasChanges: boolean;
    onAddApplicant: (userId: number) => void;
    onRemoveApplicant: (userId: number) => void;
    onMoveApplicant: (applicantIndex: number, direction: number) => void;
    onSaveRankings: () => void;
}) {
    const {
        position,
        positionIndex,
        saving,
        hasChanges,
        onAddApplicant,
        onRemoveApplicant,
        onMoveApplicant,
        onSaveRankings
    } = props;

    return (
        <div style={styles.positionCard}>
            <div style={styles.rankNumber}></div>
            <div style={styles.positionInfo}>
                <h3 style={styles.positionName}>
                    {position.name}
                </h3>
                <p style={styles.ccaName}>{position.cca_name}</p>
                <div style={styles.positionMeta}>
                    <span style={styles.positionType}>
                        {position.position_type === 'maincomm'
                            ? 'Main Committee'
                            : position.position_type === 'subcomm'
                                ? 'Sub Committee'
                                : position.position_type
                        }
                    </span>
                    <span style={styles.capacity}>Capacity: {position.capacity}</span>
                </div>
            </div>
            <div style={styles.searchAndApplicantsContainer}>
                <PositionSearchBox positionId={position.id} onAddApplicant={onAddApplicant} />

                {position.applicants.length === 0 ? (
                    <div style={styles.noApplicants}>
                        <p>No applicants added for this position. Search and add freshmen above first.</p>
                    </div>
                ) : (
                    <>
                        <div style={styles.applicantsHeader}>
                            Applicants ({position.applicants.length})
                            {position.applicants.length < position.capacity && (
                                <span style={styles.warningText}>
                                    Warning: Fewer applicants than available slots.
                                </span>
                            )}
                        </div>
                        {position.applicants.map((app: Applicant, appIdx: number) => (
                            <div key={app.id || `applicant-${appIdx}`} style={styles.applicantCard}>
                                <div style={styles.rankNumber}>{appIdx + 1}</div>
                                <div style={styles.applicantInfo}>
                                    <div style={styles.applicantName}>{app.name}</div>
                                    <div style={styles.applicantDetails}>
                                        {app.email} | Room {app.room}
                                    </div>
                                </div>
                                <div style={styles.controls}>
                                    <button
                                        style={appIdx === 0 ? styles.controlButtonDisabled : styles.controlButton}
                                        onClick={() => onMoveApplicant(appIdx, -1)}
                                        disabled={appIdx === 0}
                                        title="Move up"
                                    >
                                        ↑
                                    </button>
                                    <button
                                        style={appIdx === position.applicants.length - 1 ? styles.controlButtonDisabled : styles.controlButton}
                                        onClick={() => onMoveApplicant(appIdx, 1)}
                                        disabled={appIdx === position.applicants.length - 1}
                                        title="Move down"
                                    >
                                        ↓
                                    </button>
                                    <button
                                        style={{ ...styles.controlButton, color: '#B91C1C' }}
                                        onClick={() => onRemoveApplicant(app.id)}
                                        title="Remove from consideration"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        ))}
                    </>
                )}
                <button
                    style={saving
                        ? styles.saveButtonDisabled
                        : hasChanges
                            ? styles.saveButtonChanged
                            : styles.saveButton
                    }
                    onClick={onSaveRankings}
                    disabled={position.applicants.length === 0 || saving || !hasChanges}
                >
                    {saving ? 'Saving...' : 'Save Rankings'}
                </button>
            </div>
        </div>
    );
}

export default function RankApplicants() {
    const { user } = useAuth();
    const [positions, setPositions] = useState<Position[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false); // NEW: Global loading state
    const [originalOrders, setOriginalOrders] = useState<{ [positionId: number]: number[] }>({});
    const [hasChanges, setHasChanges] = useState<{ [positionId: number]: boolean }>({});

    useEffect(() => {
        if (!user?.email) return;

        setLoading(true);

        fetch(`/api/chair/positions/forChair/${user.email}`)
            .then((res) => res.json())
            .then((data) => {
                setPositions(data.positions || []);

                const originalOrderMap: { [positionId: number]: number[] } = {};
                const changesMap: { [positionId: number]: boolean } = {};

                (data.positions || []).forEach((position: Position) => {
                    originalOrderMap[position.id] = position.applicants.map(app => app.id);
                    changesMap[position.id] = false;
                });

                setOriginalOrders(originalOrderMap);
                setHasChanges(changesMap);
            })
            .catch((error) => {
                toast.error('Error loading positions');
            })
            .finally(() => {
                setLoading(false);
            });
    }, [user?.email]);

    const checkForChanges = useCallback((positionId: number, currentApplicants: Applicant[]) => {
        const originalOrder = originalOrders[positionId] || [];
        const currentOrder = currentApplicants.map(app => app.id);

        const hasChanged = JSON.stringify(originalOrder) !== JSON.stringify(currentOrder);

        setHasChanges(prev => ({
            ...prev,
            [positionId]: hasChanged
        }));
    }, [originalOrders]);

    // Helper function to save rankings for a specific position
    const saveRankingsForPosition = useCallback(async (position: Position): Promise<boolean> => {
        const rankings = position.applicants.map((a, i) => ({
            user_id: a.id,
            ranking: i + 1,
        }));

        try {
            const response = await fetch(`/api/chair/positions/${position.id}/rank`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rankings }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to save rankings');
            }

            return true;
        } catch (error: any) {
            console.error('Error saving rankings:', error);
            return false;
        }
    }, []);

    // Modified handleAddApplicant with loading overlay
    const handleAddApplicant = useCallback(async (positionId: number, userId: number) => {
        if (!user?.email) return;

        setIsLoading(true); // NEW: Show loading overlay

        try {
            // Find the position that's being modified
            const targetPosition = positions.find(p => p.id === positionId);

            // If there are unsaved changes, save them first
            if (targetPosition && hasChanges[positionId]) {
                const saveSuccess = await saveRankingsForPosition(targetPosition);
                if (!saveSuccess) {
                    toast.error('Failed to save current rankings before adding applicant');
                    return;
                }
            }

            const res = await fetch(`/api/chair/positions/${positionId}/addApplicant`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId }),
            });

            if (!res.ok) throw new Error('Failed to add applicant');

            // Refresh positions and reset change tracking
            const refreshRes = await fetch(`/api/chair/positions/forChair/${user.email}`);
            const refreshData = await refreshRes.json();

            setPositions(refreshData.positions || []);

            // Update original orders and reset changes for all positions
            const originalOrderMap: { [positionId: number]: number[] } = {};
            const changesMap: { [positionId: number]: boolean } = {};

            (refreshData.positions || []).forEach((position: Position) => {
                originalOrderMap[position.id] = position.applicants.map(app => app.id);
                changesMap[position.id] = false;
            });

            setOriginalOrders(originalOrderMap);
            setHasChanges(changesMap);

            toast.success('Applicant added and rankings saved');
        } catch (error) {
            toast.error('Could not add applicant');
        } finally {
            setIsLoading(false); // NEW: Hide loading overlay
        }
    }, [user?.email, positions, hasChanges, saveRankingsForPosition]);

    // Modified handleRemoveApplicant with loading overlay
    const handleRemoveApplicant = useCallback(async (positionId: number, userId: number) => {
        if (!user?.email) return;

        setIsLoading(true); // NEW: Show loading overlay

        try {
            // Find the position that's being modified
            const targetPosition = positions.find(p => p.id === positionId);

            // If there are unsaved changes, save them first
            if (targetPosition && hasChanges[positionId]) {
                const saveSuccess = await saveRankingsForPosition(targetPosition);
                if (!saveSuccess) {
                    toast.error('Failed to save current rankings before removing applicant');
                    return;
                }
            }

            const res = await fetch(`/api/chair/positions/${positionId}/removeApplicant`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId }),
            });

            if (!res.ok) throw new Error('Failed to remove applicant');

            // Refresh positions and reset change tracking
            const refreshRes = await fetch(`/api/chair/positions/forChair/${user.email}`);
            const refreshData = await refreshRes.json();

            setPositions(refreshData.positions || []);

            // Update original orders and reset changes for all positions
            const originalOrderMap: { [positionId: number]: number[] } = {};
            const changesMap: { [positionId: number]: boolean } = {};

            (refreshData.positions || []).forEach((position: Position) => {
                originalOrderMap[position.id] = position.applicants.map(app => app.id);
                changesMap[position.id] = false;
            });

            setOriginalOrders(originalOrderMap);
            setHasChanges(changesMap);

            toast.success('Applicant removed and rankings saved');
        } catch (error) {
            toast.error('Could not remove applicant');
        } finally {
            setIsLoading(false); // NEW: Hide loading overlay
        }
    }, [user?.email, positions, hasChanges, saveRankingsForPosition]);

    const handleMoveApplicant = useCallback((positionIndex: number, applicantIndex: number, delta: number) => {
        setPositions((prevPositions) => {
            const newPositions = [...prevPositions];
            const position = newPositions[positionIndex];
            if (!position) return prevPositions;

            const apps = [...position.applicants];
            const targetIndex = applicantIndex + delta;
            if (targetIndex < 0 || targetIndex >= apps.length) return prevPositions;

            [apps[applicantIndex], apps[targetIndex]] = [apps[targetIndex], apps[applicantIndex]];
            newPositions[positionIndex] = { ...position, applicants: apps };

            checkForChanges(position.id, apps);

            return newPositions;
        });
    }, [checkForChanges]);

    // Modified handleSaveRankings with loading overlay
    const handleSaveRankings = useCallback(async (position: Position) => {
        setSaving(position.id);
        setIsLoading(true); // NEW: Show loading overlay

        const success = await saveRankingsForPosition(position);

        if (success) {
            setHasChanges(prev => ({ ...prev, [position.id]: false }));
            setOriginalOrders(prev => ({
                ...prev,
                [position.id]: position.applicants.map(app => app.id)
            }));

            toast.success(`Rankings saved for ${position.name}!`);
        } else {
            toast.error('Failed to save rankings');
        }

        setSaving(null);
        setIsLoading(false); // NEW: Hide loading overlay
    }, [saveRankingsForPosition]);

    if (loading) {
        return (
            <div style={styles.container}>
                <Sidebar />
                <div style={styles.content}>
                    <div style={styles.loading}>Loading CCA positions and applicants...</div>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <Sidebar />
            <div style={styles.content}>
                <div style={styles.header}>
                    <h1 style={styles.title}>
                        Rank Applicants for Your CCA
                    </h1>
                    <p style={styles.subtitle}>
                        For each position you manage, add/select applicants to consider and arrange them in order of preference.
                        Adding or removing applicants will automatically save any pending ranking changes.
                    </p>
                </div>

                {positions.length === 0 ? (
                    <div style={styles.emptyState}>
                        <p>You don't have any CCA positions to manage as chair/head/vice.</p>
                        <p>Check your database chair appointments or try switching users.</p>
                    </div>
                ) : (
                    <div style={styles.rankingContainer}>
                        {positions.map((pos: Position, posIdx: number) => (
                            <PositionCard
                                key={pos.id}
                                position={pos}
                                positionIndex={posIdx}
                                saving={saving === pos.id}
                                hasChanges={hasChanges[pos.id] || false}
                                onAddApplicant={handleAddApplicant.bind(null, pos.id)}
                                onRemoveApplicant={handleRemoveApplicant.bind(null, pos.id)}
                                onMoveApplicant={(appIdx: number, delta: number) => handleMoveApplicant(posIdx, appIdx, delta)}
                                onSaveRankings={() => handleSaveRankings(pos)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* NEW: Loading Overlay */}
            <LoadingOverlay visible={isLoading} />
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
        color: '#7A7A7A'
    },
    rankingContainer: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '28px'
    },
    positionCard: {
        display: 'flex',
        alignItems: 'flex-start',
        padding: '20px',
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        transition: 'all 0.2s ease',
        marginBottom: 4
    },
    rankNumber: {
        fontSize: '22px',
        fontWeight: 'bold',
        color: '#6B7280',
        marginRight: '20px',
        minWidth: '40px',
        textAlign: 'center' as const,
        marginTop: '6px'
    },
    positionInfo: {
        minWidth: '220px',
        marginRight: '24px'
    },
    positionName: {
        fontSize: '18px',
        fontWeight: 'bold',
        color: '#1F2937',
        margin: '0 0 5px 0'
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
    applicantCard: {
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid #F4F4F4',
        padding: '6px'
    },
    noApplicants: {
        color: '#B91C1C',
        marginBottom: 10,
        fontSize: '13px'
    },
    controls: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '8px',
        marginLeft: '16px'
    },
    controlButton: {
        width: '32px',
        height: '32px',
        borderRadius: '6px',
        border: '1px solid #D1D5DB',
        backgroundColor: '#FFFFFF',
        cursor: 'pointer',
        fontSize: '17px',
        color: '#4B5563',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease',
    },
    controlButtonDisabled: {
        width: '32px',
        height: '32px',
        borderRadius: '6px',
        border: '1px solid #E5E7EB',
        backgroundColor: '#F9FAFB',
        cursor: 'not-allowed',
        fontSize: '17px',
        color: '#D1D5DB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    saveButton: {
        backgroundColor: 'gray',
        color: 'white',
        padding: '10px 20px',
        borderRadius: '6px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
        marginTop: 16
    },
    saveButtonChanged: {
        backgroundColor: '#10B981',
        color: 'white',
        padding: '10px 20px',
        borderRadius: '6px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
        marginTop: 16,
        boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)'
    },
    saveButtonDisabled: {
        backgroundColor: '#9CA3AF',
        color: 'white',
        padding: '10px 20px',
        borderRadius: '6px',
        border: 'none',
        cursor: 'not-allowed',
        fontSize: '14px',
        fontWeight: 'bold',
        marginTop: 16
    },
    searchInput: {
        width: '60%',
        padding: '8px',
        border: '1px solid #D1D5DB',
        borderRadius: 6,
        fontSize: 14
    },
    searchContainer: {
        marginBottom: 8,
        position: 'relative' as const
    },
    searchResultsContainer: {
        position: 'absolute' as const,
        background: '#fff',
        border: '1px solid #DDD',
        borderRadius: 4,
        boxShadow: '0 2px 4px rgba(0,0,0,0.10)',
        zIndex: 10,
        width: '350px',
        maxHeight: '200px',
        overflowY: 'auto' as const
    },
    searchResultItem: {
        padding: 8,
        cursor: 'pointer' as const,
        borderBottom: '1px solid #f0f0f0'
    },
    searchAndApplicantsContainer: {
        flex: 2,
        marginLeft: 12
    },
    applicantsHeader: {
        marginBottom: 6,
        fontWeight: 500
    },
    warningText: {
        color: '#FF8A24',
        marginLeft: 10
    },
    applicantInfo: {
        flex: 1
    },
    applicantName: {
        fontWeight: 500,
        color: '#1F2937'
    },
    applicantDetails: {
        fontSize: 13,
        color: '#555'
    },
    // NEW: Loading overlay styles
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
