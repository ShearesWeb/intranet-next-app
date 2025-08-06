// C:\Ron\intranet-next-app\src\hooks\useRoleAuth.ts

'use client';

import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';

export const useRoleAuth = () => {
    const { user } = useAuth();
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [loading, setLoading] = useState(true);
    const [userPositions, setUserPositions] = useState([]);
    const [roleDetails, setRoleDetails] = useState({ isLead: false, isVice: false });

    useEffect(() => {
        const checkPermissions = async () => {
            if (!user?.email) {
                setIsAuthorized(false);
                setLoading(false);
                return;
            }

            try {
                const response = await fetch(`/api/user/checkRole/${user.email}`);
                if (!response.ok) {
                    setIsAuthorized(false);
                    setLoading(false);
                    return;
                }

                const data = await response.json();
                setIsAuthorized(data.isAuthorized);
                setUserPositions(data.positions || []);

                // Enhanced role details
                setRoleDetails({
                    isLead: data.positions?.some((pos: string) => pos.toLowerCase().includes('lead')),
                    isVice: data.positions?.some((pos: string) => pos.toLowerCase().includes('vice')),
                });
            } catch (error) {
                console.error('Error checking permissions:', error);
                setIsAuthorized(false);
            } finally {
                setLoading(false);
            }
        };

        checkPermissions();
    }, [user?.email]);

    return { isAuthorized, loading, userPositions, roleDetails };
};
