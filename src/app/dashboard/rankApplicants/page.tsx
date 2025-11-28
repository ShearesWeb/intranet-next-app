'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePhaseInfo } from '@/hooks/usePhaseInfo';
import toast from 'react-hot-toast';
import { AppLayout } from '@/components/layout/app-layout';
import { AppLoading } from '@/components/layout/app-loading';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowUp, ArrowDown, X, Search, Loader2 } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Applicant, Position, UserSearchResult } from '@/types/dashboard';

// Position Search Box Component
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
    const [isSearching, setIsSearching] = useState(false);

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

    const handleSearch = useCallback(async () => {
        if (searchTerm.length < 2) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const res = await fetch(`/api/user/search?query=${encodeURIComponent(searchTerm)}`);
            if (!res.ok) {
                throw new Error(`HTTP error: ${res.status}`);
            }
            const data = await res.json();
            setSearchResults(data.data || []);
        } catch (error) {
            console.error('Search error:', error);
            setSearchResults([]);
            toast.error('Search failed. Please try again.');
        } finally {
            setIsSearching(false);
        }
    }, [searchTerm]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        if (e.target.value.length < 2) {
            setSearchResults([]);
        }
    }, []);

    const handleResultClick = useCallback((userData: UserSearchResult) => {
        onAddApplicant(userData);
        if (inputRef.current) {
            inputRef.current.value = '';
            setSearchTerm('');
            inputRef.current.focus();
        }
        setSearchResults([]);
    }, [onAddApplicant]);

    return (
        <div ref={containerRef} className="relative mb-2">
            <div className="flex gap-2 items-center">
                <Input
                    ref={inputRef}
                    type="text"
                    placeholder="Search user by name/email/room"
                    value={searchTerm}
                    onChange={handleInputChange}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onKeyPress={(e) => e.key === 'Enter' && !isSearching && handleSearch()}
                    autoComplete="off"
                    disabled={isSearching}
                    className="flex"
                />
                <Button
                    onClick={handleSearch}
                    disabled={searchTerm.length < 2 || isSearching}
                    className="gap-2 flex-shrink-0"
                >
                    {isSearching ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading...
                        </>
                    ) : (
                        <>
                            <Search className="h-4 w-4" />
                            Search
                        </>
                    )}
                </Button>
            </div>

            {searchResults.length > 0 && (
                <div className="absolute mt-1 top-full bg-background border rounded-md shadow-lg z-10 max-h-[200px] overflow-y-auto">
                    {searchResults.map(user => (
                        <div
                            key={user.id}
                            className="p-2 cursor-pointer border-b last:border-b-0 hover:bg-accent transition-colors"
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

// Position Card Component
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
        <Card className="shadow-sm transition-all hover:shadow-md mb-6">
            <div className="flex items-start p-5 gap-4">
                <div className="text-2xl font-bold text-muted-foreground pr-5 min-w-[40px] text-center mt-1.5">
                    {/* Rank number placeholder */}
                </div>

                <div className="mr-6">
                    <h3 className="text-lg font-bold text-foreground">
                        {position.name}
                    </h3>
                    <p className="py-2 text-base text-muted-foreground">
                        {position.cca_name}
                    </p>
                    <div className="inline-flex items-center justify-center mb-2 gap-2">
                        <span className="text-xs px-2 py-1.5 gap-1.5 bg-primary/10 text-primary rounded-xs font-bold">
                            {position.position_type === 'maincomm'
                                ? 'Main Committee'
                                : position.position_type === 'subcomm'
                                    ? 'Sub Committee'
                                    : position.position_type
                            }
                        </span>
                        <span className="flex p-1 text-sm text-muted-foreground self-center">
                            Available Capacity: {position.available_capacity}
                        </span>
                    </div>
                </div>

                <div className="flex-1 px-4">
                    <PositionSearchBox onAddApplicant={onAddApplicant} />
                    {position.applicants.length === 0 ? (
                        <div className="text-red-500 mb-2.5 text-sm p-2">
                            <p>No applicants added for this position. Use the search above to find and add applicants.</p>
                        </div>
                    ) : (
                        <>
                            <div className="mb-2.5 text-medium font-light p-2">
                                Applicants ({position.applicants.length})
                                {position.applicants.length < position.available_capacity && (
                                    <span className="text-red-500 text-medium ml-1">
                                        Warning: Fewer applicants than available slots.
                                    </span>
                                )}
                            </div>
                            {position.applicants.map((app: Applicant, appIdx: number) => (
                                <div
                                    key={app.id || `applicant-${appIdx}`}
                                    className="flex items-center border-b border-gray-100 py-1.5 mb-5"
                                >
                                    <div className="text-2xl p-5 font-bold text-muted-foreground mr-5 min-w-[40px] text-center">
                                        {appIdx + 1}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-medium text-foreground">
                                            {app.name}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            {app.email} | Room {app.room}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2 ml-4">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => onMoveApplicant(appIdx, -1)}
                                            disabled={appIdx === 0}
                                            title="Move up"
                                        >
                                            <ArrowUp className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => onMoveApplicant(appIdx, 1)}
                                            disabled={appIdx === position.applicants.length - 1}
                                            title="Move down"
                                        >
                                            <ArrowDown className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8 hover:text-destructive"
                                            onClick={() => onRemoveApplicant(app.id)}
                                            title="Remove from consideration"
                                        >
                                            <X className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}

                    <Button
                        onClick={onSaveRankings}
                        disabled={saving || !hasChanges}
                        className="mt-6 font-semibold"
                        variant={hasChanges ? "default" : "secondary"}>
                        {saving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            'Save Rankings'
                        )}
                    </Button>
                </div>
            </div>
        </Card>
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
    const fetchingRef = useRef<boolean>(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    const fetchPositions = useRef(async (bustCache = false) => {
        if (!user?.email) return;

        try {
            const url = `/api/chair/positions/forChair`;
            const headers: HeadersInit = {};

            if (bustCache) {
                headers['Cache-Control'] = 'no-cache';
                headers['Pragma'] = 'no-cache';
            }

            const response = await fetch(url, { headers });
            const data = await response.json();

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
    });

    useEffect(() => {
        if (!user?.email || fetchingRef.current) return;

        fetchingRef.current = true;
        setLoading(true);
        fetchPositions.current().finally(() => {
            setLoading(false);
            fetchingRef.current = false;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.email]); // fetchPositions is a ref, so it's stable

    const checkForChanges = useCallback((positionId: number, currentApplicants: Applicant[]) => {
        const originalOrder = originalOrders[positionId] || [];
        const currentOrder = currentApplicants.map(app => app.id);

        const hasChanged = JSON.stringify(originalOrder) !== JSON.stringify(currentOrder);

        setHasChanges(prev => ({
            ...prev,
            [positionId]: hasChanged
        }));
    }, [originalOrders]);

    const handleAddApplicant = useCallback((positionId: number, userData: UserSearchResult) => {
        setPositions(prevPositions => {
            const newPositions = prevPositions.map(pos => {
                if (pos.id === positionId) {
                    if (pos.applicants.some(app => app.id === userData.id)) {
                        toast.error('Applicant already added to this position');
                        return pos;
                    }

                    const newApplicant: Applicant = {
                        id: userData.id,
                        name: userData.name,
                        email: userData.email,
                        room: userData.room || 'N/A',
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

            for (const userId of toAdd) {
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
            }

            for (const userId of toRemove) {
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
            }

            if (position.applicants.length > 0) {
                const rankings = position.applicants.map((a, i) => ({
                    user_id: a.id,
                    ranking: i + 1,
                }));

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
            }

            return true;
        } catch (error) {
            console.error('Error saving rankings:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to save rankings');
            return false;
        }
    }, [originalOrders]);

    const handleSaveRankings = useCallback(async (position: Position) => {
        setSaving(position.id);
        setIsLoading(true);

        try {
            const success = await saveRankingsForPosition(position);

            if (success) {
                await fetchPositions.current(true);
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

    if (!mounted || !user) return <AppLoading />;

    if (loading || phaseLoading) {
        return (
            <AppLayout>
                <LoadingSpinner message="Loading CCA positions and applicants..." />
            </AppLayout>
        );
    }

    if (!phaseInfo.allowChairRanking) {
        const getStatusMessage = () => {
            switch (phaseInfo.phase) {
                case 'maincomm_interviews':
                    return "Maincomm interviews are in progress. Chair ranking opens after interviews complete.";
                case 'maincomm_results_processing':
                    return "Maincomm results are currently being processed. Results will be available soon."
                case 'maincomm_results_available':
                    return "Maincomm results have been released. Subcomm interviews will begin soon.";
                case 'subcomm_interviews':
                    return "Subcomm interviews are in progress. Chair ranking opens after interviews complete.";
                case 'subcomm_results_processing':
                    return "Subcomm results are currently being processed. Results will be available soon."
                case 'full_results_available':
                    return "Subcomm results have been released. Chair ranking is currently not active.";
                default:
                    return "Chair ranking is currently not active.";
            }
        };

        return (
            <AppLayout>
                <div className="space-y-6 p-6">
                    <Card className="border-none shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-3xl">Rank Applicants for Your CCA</CardTitle>
                            <p className="text-muted-foreground mt-2">
                                Manage and rank applicants for your CCA positions.
                            </p>
                        </CardHeader>
                    </Card>

                    <Card className="border-none shadow-lg">
                        <CardContent className="pt-6 text-center">
                            <p className="text-muted-foreground mb-2">{getStatusMessage()}</p>
                            {phaseInfo.nextPhaseDate && (
                                <p className="text-sm">
                                    <strong>Next Update:</strong> {phaseInfo.nextPhaseDate}
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="space-y-6 p-6">
                <Card className="border-none shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-4xl">Rank Applicants for Your CCA</CardTitle>
                        <p className="text-muted-foreground mt-2">
                            Search and add applicants, then arrange them in order of preference.
                            Changes are saved only when you click the &quot;Save Rankings&quot; button.
                        </p>
                    </CardHeader>
                </Card>

                {positions.length === 0 ? (
                    <Card className="border-none shadow-lg">
                        <CardContent className="pt-6 text-center">
                            <p className="text-muted-foreground mb-2">
                                You do not have any CCA positions to manage as chair/head/vice.
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Check your database chair appointments or try switching users.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-7">
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

            {isLoading && <LoadingSpinner message="Saving rankings..." overlay />}
        </AppLayout>
    );
}
