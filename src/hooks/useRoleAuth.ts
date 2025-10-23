// src/hooks/useRoleAuth.ts
'use client';

import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';

interface RoleAuthResult {
    isAuthorized: boolean;
    positions: string[];
}

interface CachedRoleAuth extends RoleAuthResult {
    timestamp: number;
    email: string;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes client-side cache
const STORAGE_KEY = 'roleAuthCache';

export const useRoleAuth = () => {
    const { user } = useAuth();
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [loading, setLoading] = useState(true);
    const [userPositions, setUserPositions] = useState<string[]>([]);
    const [roleDetails, setRoleDetails] = useState({ isLead: false, isVice: false });

    useEffect(() => {
        const checkPermissions = async () => {
            if (!user?.email) {
                setIsAuthorized(false);
                setLoading(false);
                return;
            }

            try {
                // ✅ Check client-side cache first
                const cachedData = getCachedRoleAuth(user.email);
                if (cachedData) {
                    updateStateFromCache(cachedData);
                    setLoading(false);
                    return;
                }

                // ✅ Fetch from API with cache headers
                const response = await fetch(`/api/user/checkRole`, {
                    headers: {
                        'Cache-Control': 'max-age=300', // Respect server cache
                    }
                });

                if (!response.ok) {
                    setIsAuthorized(false);
                    setLoading(false);
                    return;
                }

                const data = await response.json();

                // ✅ Cache the result
                setCachedRoleAuth(user.email, data);

                updateStateFromCache(data);
            } catch (error) {
                console.error('Error checking permissions:', error);
                setIsAuthorized(false);
            } finally {
                setLoading(false);
            }
        };

        checkPermissions();
    }, [user?.email]);

    // ✅ Helper function to update state
    const updateStateFromCache = (data: RoleAuthResult) => {
        setIsAuthorized(data.isAuthorized);
        setUserPositions(data.positions || []);
        setRoleDetails({
            isLead: data.positions?.some((pos: string) => pos.toLowerCase().includes('lead')) || false,
            isVice: data.positions?.some((pos: string) => pos.toLowerCase().includes('vice')) || false,
        });
    };

    return { isAuthorized, loading, userPositions, roleDetails };
};

// ✅ Client-side cache helpers
function getCachedRoleAuth(email: string): RoleAuthResult | null {
    try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (!cached) return null;

        const data: CachedRoleAuth = JSON.parse(cached);

        // Check if cache is valid and for the right user
        if (data.email !== email || Date.now() - data.timestamp > CACHE_DURATION) {
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }

        return {
            isAuthorized: data.isAuthorized,
            positions: data.positions
        };
    } catch {
        localStorage.removeItem(STORAGE_KEY);
        return null;
    }
}

function setCachedRoleAuth(email: string, data: RoleAuthResult) {
    try {
        const cacheData: CachedRoleAuth = {
            ...data,
            timestamp: Date.now(),
            email
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cacheData));
    } catch (error) {
        // Ignore storage errors
        console.warn('Failed to cache role auth:', error);
    }
}
