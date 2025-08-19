// C:\Ron\intranet-next-app\src\app\dashboard\rankApplicants\page.tsx
'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/context/AuthContext';
import { usePhaseInfo } from '@/hooks/usePhaseInfo';
import toast from 'react-hot-toast';

// Types
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
    total_capacity: number;
    available_capacity: number;
    applied_count: number;
    position_type: string;
    applicants: Applicant[];
}

interface UserSearchResult {
    id: number;
    name: string;
    email: string;
    room?: string | null;
}

// Loading Overlay Component
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

// ✅ FIXED: PositionSearchBox with loading state and proper user data handling
function PositionSearchBox({
    onAddApplicant
}: {
    onAddApplicant: (userData: UserSearchResult) => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
    const [isUserFocused, setIsUserFocused] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSearching, setIsSearching] = useState(false); // ✅ NEW: Loading state

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

    // ✅ FIXED: Search with loading state
    const handleSearch = useCallback(async () => {
        if (searchTerm.length < 2) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true); // ✅ Show loading state
        try {
            const res = await fetch(`/api/user/search?query=${encodeURIComponent(searchTerm)}`);
            if (!res.ok) {
                throw new Error(`HTTP error: ${res.status}`);
            }
            const data = await res.json();
            setSearchResults(data.users || []);
        } catch (error) {
            console.error('Search error:', error);
            setSearchResults([]);
            toast.error('Search failed. Please try again.');
        } finally {
            setIsSearching(false); // ✅ Hide loading state
        }
    }, [searchTerm]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        if (e.target.value.length < 2) {
            setSearchResults([]);
        }
    }, []);

    // ✅ FIXED: Pass complete user data instead of just ID
    const handleResultClick = useCallback((userData: UserSearchResult) => {
        onAddApplicant(userData); // Pass full user data
        if (inputRef.current) {
            inputRef.current.value = '';
            setSearchTerm('');
            inputRef.current.focus();
        }
        setSearchResults([]);
    }, [onAddApplicant]);

    return (
        <div ref={containerRef} style={styles.searchContainer}>
            <div style={styles.searchInputContainer}>
                <input
                    ref={inputRef}
                    style={styles.searchInput}
                    type="text"
                    placeholder="Search user by intranet gmail..."
                    value={searchTerm}
                    onChange={handleInputChange}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onKeyPress={(e) => e.key === 'Enter' && !isSearching && handleSearch()}
                    autoComplete="off"
                    disabled={isSearching} // ✅ Disable during search
                />
                {/* ✅ FIXED: Search button with loading state */}
                <button
                    style={isSearching ? styles.searchButtonLoading : styles.searchButton}
                    onClick={handleSearch}
                    disabled={searchTerm.length < 2 || isSearching}
                >
                    {isSearching ? 'Loading...' : 'Search'}
                </button>
            </div>

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
                            onClick={() => handleResultClick(user)}
                        >
                            {user.name} ({user.email}{user.room ? `, Room ${user.room}` : ''})
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// PositionCard component
function PositionCard(props: {
    position: Position;
    positionIndex: number;
    saving: boolean;
    hasChanges: boolean;
    onAddApplicant: (userData: UserSearchResult) => void;
    onRemoveApplicant: (userId: number) => void;
    onMoveApplicant: (applicantIndex: number, direction: number) => void;
    onSaveRankings: () => void;
}) {
    const {
        position,
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
                    <span style={styles.capacity}>Available Capacity: {position.available_capacity}</span>
                </div>
            </div>
            <div style={styles.searchAndApplicantsContainer}>
                <PositionSearchBox onAddApplicant={onAddApplicant} />

                {position.applicants.length === 0 ? (
                    <div style={styles.noApplicants}>
                        <p>No applicants added for this position. Use the search above to find and add applicants.</p>
                    </div>
                ) : (
                    <>
                        <div style={styles.applicantsHeader}>
                            Applicants ({position.applicants.length})
                            {position.applicants.length < position.available_capacity && (
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
                            : styles.saveButtonDisabled
                    }
                    onClick={onSaveRankings}
                    disabled={saving || !hasChanges}
                >
                    {saving ? 'Saving...' : 'Save Rankings'}
                </button>
            </div>
        </div>
    );
}

export default function RankApplicants() {
    const { user } = useAuth();
    const { phaseInfo, loading: phaseLoading } = usePhaseInfo();
    const [positions, setPositions] = useState<Position[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [originalOrders, setOriginalOrders] = useState<{ [positionId: number]: number[] }>({});
    const [hasChanges, setHasChanges] = useState<{ [positionId: number]: boolean }>({});

    // ✅ FIXED: Fetch positions with cache-busting for fresh data
    const fetchPositions = useCallback(async (bustCache = false) => {
        if (!user?.email) return;

        try {
            const url = `/api/chair/positions/forChair/${user.email}`;
            const headers: HeadersInit = {};

            // ✅ Cache busting when needed (after saves)
            if (bustCache) {
                headers['Cache-Control'] = 'no-cache';
                headers['Pragma'] = 'no-cache';
            }

            const response = await fetch(url, { headers });
            const data = await response.json();

            // console.log("DATA DATA DATA: ", data)

            setPositions(data.positions || []);

            const originalOrderMap: { [positionId: number]: number[] } = {};
            const changesMap: { [positionId: number]: boolean } = {};

            (data.positions || []).forEach((position: Position) => {
                originalOrderMap[position.id] = position.applicants.map(app => app.id);
                changesMap[position.id] = false;
            });

            setOriginalOrders(originalOrderMap);
            setHasChanges(changesMap);
        } catch (error) {
            console.error('Error fetching positions:', error);
            toast.error('Error loading positions');
        }
    }, [user?.email]);

    useEffect(() => {
        if (!user?.email) return;

        setLoading(true);
        fetchPositions().finally(() => setLoading(false));
    }, [user?.email, fetchPositions]);

    const checkForChanges = useCallback((positionId: number, currentApplicants: Applicant[]) => {
        const originalOrder = originalOrders[positionId] || [];
        const currentOrder = currentApplicants.map(app => app.id);

        const hasChanged = JSON.stringify(originalOrder) !== JSON.stringify(currentOrder);

        setHasChanges(prev => ({
            ...prev,
            [positionId]: hasChanged
        }));
    }, [originalOrders]);

    // ✅ FIXED: Add applicant with proper user data (no more "Loading...")
    const handleAddApplicant = useCallback((positionId: number, userData: UserSearchResult) => {
        setPositions(prevPositions => {
            const newPositions = prevPositions.map(pos => {
                if (pos.id === positionId) {
                    // Check if user already exists
                    if (pos.applicants.some(app => app.id === userData.id)) {
                        toast.error('Applicant already added to this position');
                        return pos;
                    }

                    const newApplicant: Applicant = {
                        id: userData.id,
                        name: userData.name,
                        email: userData.email,
                        room: userData.room || 'N/A', // ✅ Proper room handling
                        ranking: null
                    };

                    const updatedApplicants = [...pos.applicants, newApplicant];

                    setTimeout(() => checkForChanges(positionId, updatedApplicants), 0);

                    return {
                        ...pos,
                        applicants: updatedApplicants
                    };
                }
                return pos;
            });

            return newPositions;
        });

    }, [checkForChanges]);

    const handleRemoveApplicant = useCallback((positionId: number, userId: number) => {
        setPositions(prevPositions => {
            const newPositions = prevPositions.map(pos => {
                if (pos.id === positionId) {
                    const updatedApplicants = pos.applicants.filter(app => app.id !== userId);

                    setTimeout(() => checkForChanges(positionId, updatedApplicants), 0);

                    return {
                        ...pos,
                        applicants: updatedApplicants
                    };
                }
                return pos;
            });

            return newPositions;
        });

    }, [checkForChanges]);

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

    const saveRankingsForPosition = useCallback(async (position: Position): Promise<boolean> => {
        try {
            const originalApplicantIds = originalOrders[position.id] || [];
            const currentApplicantIds = position.applicants.map(app => app.id);

            const toAdd = currentApplicantIds.filter(id => !originalApplicantIds.includes(id));
            const toRemove = originalApplicantIds.filter(id => !currentApplicantIds.includes(id));

            // console.log(`Saving for position ${position.id}:`, { toAdd, toRemove });

            // Add new applicants to backend
            for (const userId of toAdd) {
                // console.log(`Adding user ${userId} to position ${position.id}`);
                const response = await fetch(`/api/chair/positions/${position.id}/addApplicant`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error(`Failed to add user ${userId}:`, errorData);
                    throw new Error(`Failed to add applicant: ${errorData.error}`);
                }

                await response.json();
                // console.log(`Successfully added user ${userId}:`, result);
            }

            // Remove applicants from backend
            for (const userId of toRemove) {
                // console.log(`Removing user ${userId} from position ${position.id}`);
                const response = await fetch(`/api/chair/positions/${position.id}/removeApplicant`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error(`Failed to remove user ${userId}:`, errorData);
                    throw new Error(`Failed to remove applicant: ${errorData.error}`);
                }

                await response.json();
                // console.log(`Successfully removed user ${userId}:`, result);
            }

            // Save the current ranking order
            if (position.applicants.length > 0) {
                const rankings = position.applicants.map((a, i) => ({
                    user_id: a.id,
                    ranking: i + 1,
                }));

                // console.log(`Updating rankings for position ${position.id}:`, rankings);

                const response = await fetch(`/api/chair/positions/${position.id}/rank`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rankings }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error(`Failed to update rankings:`, errorData);
                    throw new Error(`Failed to save rankings: ${errorData.error}`);
                }

                await response.json();
                // console.log(`Successfully updated rankings:`, result);
            }

            return true;
        } catch (error) {
            console.error('Error saving rankings:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to save rankings');
            return false;
        }
    }, [originalOrders]);


    // ✅ FIXED: Refresh data after save with cache busting
    const handleSaveRankings = useCallback(async (position: Position) => {
        setSaving(position.id);
        setIsLoading(true);

        try {
            const success = await saveRankingsForPosition(position);

            if (success) {
                // ✅ FIXED: Refresh positions with cache busting after save
                await fetchPositions(true);

                toast.success(`Rankings saved for ${position.name}!`);
            } else {
                toast.error('Failed to save rankings');
            }
        } catch {
            toast.error('Failed to save rankings');
        } finally {
            setSaving(null);
            setIsLoading(false);
        }
    }, [saveRankingsForPosition, fetchPositions]);

    if (loading || phaseLoading) {
        return (
            <div style={styles.container}>
                <Sidebar />
                <div style={styles.content}>
                    <div style={styles.loading}>Loading CCA positions and applicants...</div>
                </div>
            </div>
        );
    }

    if (!phaseInfo.allowChairRanking) {
        const getStatusMessage = () => {
            switch (phaseInfo.phase) {
                case 'maincomm_interviews':
                    return "Maincomm interviews are in progress. Chair ranking opens after interviews complete.";
                case 'applicant_ranking_maincomm':
                    return "Applicants are currently ranking maincomm positions. Maincomm results processing will begin soon.";
                case 'maincomm_results_processing':
                    return "Maincomm results are currently being processed. Results will be available soon."
                case 'maincomm_results_available':
                    return "Maincomm results have been released. Subcomm interviews will begin soon.";
                case 'subcomm_interviews':
                    return "Subcomm interviews are in progress. Chair ranking opens after interviews complete.";
                case 'applicant_ranking_subcomm':
                    return "Applicants are currently ranking subcomm positions. Chair ranking has ended.";
                case 'subcomm_results_processing':
                    return "Subcomm results are currently being processed. Results will be available soon."
                case 'full_results_available':
                    return "Subcomm results have been released. Chair ranking is not currently active.";
                default:
                    return "Chair ranking is not currently active.";
            }
        };

        return (
            <div style={styles.container}>
                <Sidebar />
                <div style={styles.content}>
                    <div style={styles.header}>
                        <h1 style={styles.title}>Rank Applicants for Your CCA</h1>
                        <p style={styles.subtitle}>Manage and rank applicants for your CCA positions.</p>
                    </div>

                    <div style={styles.emptyState}>
                        <p>{getStatusMessage()}</p>
                        {phaseInfo.nextPhaseDate && (
                            <p><strong>Next Update:</strong> {phaseInfo.nextPhaseDate}</p>
                        )}
                    </div>
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
                        Search and add applicants, then arrange them in order of preference.
                        Changes are saved only when you click the &quot;Save Rankings&quot; button.
                    </p>
                </div>

                {positions.length === 0 ? (
                    <div style={styles.emptyState}>
                        <p>You do not have any CCA positions to manage as chair/head/vice.</p>
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
    searchInputContainer: {
        display: 'flex',
        gap: '8px',
        marginBottom: '8px',
        alignItems: 'center'
    },
    searchInput: {
        width: '60%',
        padding: '8px',
        border: '1px solid #D1D5DB',
        borderRadius: '6px',
        fontSize: '14px'
    },
    // ✅ FIXED: Normal search button state
    searchButton: {
        backgroundColor: '#3B82F6',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '6px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
        transition: 'all 0.2s ease'
    },
    // ✅ NEW: Loading search button state
    searchButtonLoading: {
        backgroundColor: '#9CA3AF', // Gray color
        color: 'white',
        padding: '8px 16px',
        borderRadius: '6px',
        border: 'none',
        cursor: 'not-allowed',
        fontSize: '14px',
        fontWeight: 'bold',
        transition: 'all 0.2s ease'
    },
    searchContainer: {
        marginBottom: '8px',
        position: 'relative' as const
    },
    searchResultsContainer: {
        position: 'absolute' as const,
        background: '#fff',
        border: '1px solid #DDD',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.10)',
        zIndex: 10,
        width: '350px',
        maxHeight: '200px',
        overflowY: 'auto' as const
    },
    searchResultItem: {
        padding: '8px',
        cursor: 'pointer' as const,
        borderBottom: '1px solid #f0f0f0'
    },
    searchAndApplicantsContainer: {
        flex: 2,
        marginLeft: '12px'
    },
    applicantsHeader: {
        marginBottom: '6px',
        fontWeight: '500'
    },
    warningText: {
        color: '#FF8A24',
        marginLeft: '10px'
    },
    applicantInfo: {
        flex: 1
    },
    applicantName: {
        fontWeight: '500',
        color: '#1F2937'
    },
    applicantDetails: {
        fontSize: '13px',
        color: '#555'
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
