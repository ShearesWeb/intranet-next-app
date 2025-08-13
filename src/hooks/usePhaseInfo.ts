// src/hooks/usePhaseInfo.ts
'use client';

import { useEffect, useState } from 'react';

interface PhaseInfo {
    phase: string;
    round: string;
    allowChairRanking: boolean;
    allowApplicantRanking: boolean;
    showResults: boolean;
    userMessage: string;
    nextPhaseDate?: string;
    serverTime: string;
    activeFlags: string[];
    isTestingMode?: boolean;
}

export const usePhaseInfo = () => {
    const [phaseInfo, setPhaseInfo] = useState<PhaseInfo>({
        phase: 'inactive',
        round: 'inactive',
        allowChairRanking: false,
        allowApplicantRanking: false,
        showResults: false,
        userMessage: 'Loading...',
        nextPhaseDate: undefined,
        serverTime: '',
        activeFlags: [],
        isTestingMode: false
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPhaseInfo = async () => {
        try {
            const response = await fetch('/api/system/currentPhase');
            if (!response.ok) {
                throw new Error('Failed to fetch phase info');
            }
            const data = await response.json();
            setPhaseInfo(data);
            setError(null);
        } catch (err) {
            console.error('Error fetching phase info:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPhaseInfo();

        // Refresh phase info every 30 seconds
        const interval = setInterval(fetchPhaseInfo, 30000);
        return () => clearInterval(interval);
    }, []);

    // Manual refresh function
    const refreshPhaseInfo = () => {
        setLoading(true);
        fetchPhaseInfo();
    };

    return {
        phaseInfo,
        loading,
        error,
        refreshPhaseInfo
    };
};
