// src/lib/lead-auth-service.ts
// Centralized authorization service for CCA chair/lead/vice roles
import { SupabaseClient } from '@supabase/supabase-js';

export const AUTHORIZED_CHAIR_ROLES = ['lead', 'vice'] as const;
export type ChairRole = typeof AUTHORIZED_CHAIR_ROLES[number];

/**
 * Check if a user has chair authorization for a specific CCA
 * @param userId - The user ID to check
 * @param ccaId - The CCA ID to check authorization for
 * @param supabase - Supabase client instance
 * @returns Object with authorized boolean and optional error
 */
export async function checkCCAChairAuthorization(
    userId: number,
    ccaId: number,
    supabase: SupabaseClient<any, any, any>
): Promise<{ authorized: boolean; error?: string }> {
    try {
        const { data: userAppointments, error } = await supabase
            .from('cca_appointments')
            .select(`
                cca_positions!inner (
                    cca_id,
                    position_type
                )
            `)
            .eq('user_id', userId)
            .eq('cca_positions.cca_id', ccaId)
            .in('cca_positions.position_type', AUTHORIZED_CHAIR_ROLES);

        if (error) {
            return { authorized: false, error: error.message };
        }

        return {
            authorized: userAppointments && userAppointments.length > 0
        };
    } catch (error) {
        return {
            authorized: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Get all CCAs that a user has chair authorization for
 * @param userId - The user ID to check
 * @param supabase - Supabase client instance
 * @returns Object with array of CCA IDs and optional error
 */
export async function getUserAuthorizedCCAs(
    userId: number,
    supabase: SupabaseClient<any, any, any>
): Promise<{ authorized: boolean; ccaIds: number[]; error?: string }> {
    try {
        const { data: chairAppointments, error } = await supabase
            .from('cca_appointments')
            .select(`
                user_id, position_id,
                cca_positions!inner(
                    id, name, position_type, cca_id,
                    ccas(id, name)
                )
            `)
            .eq('user_id', userId);

        if (error) {
            return { authorized: false, ccaIds: [], error: error.message };
        }

        const ccasSet = new Set<number>();

        (chairAppointments || []).forEach((appointment: any) => {
            if (appointment.cca_positions) {
                const position = appointment.cca_positions;
                const positionType = (position.position_type || '').toLowerCase();
                if (AUTHORIZED_CHAIR_ROLES.includes(positionType as ChairRole)) {
                    ccasSet.add(position.cca_id);
                }
            }
        });

        return {
            authorized: ccasSet.size > 0,
            ccaIds: Array.from(ccasSet)
        };
    } catch (error) {
        return {
            authorized: false,
            ccaIds: [],
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Check if a user has chair authorization for ANY CCA
 * @param userId - The user ID to check
 * @param supabase - Supabase client instance
 * @returns Object with authorized boolean and optional error
 */
export async function hasAnyChairAuthorization(
    userId: number,
    supabase: SupabaseClient<any, any, any>
): Promise<{ authorized: boolean; error?: string }> {
    try {
        const { data: chairRoles, error } = await supabase
            .from('cca_appointments')
            .select(`
                cca_positions!inner(position_type)
            `)
            .eq('user_id', userId)
            .in('cca_positions.position_type', AUTHORIZED_CHAIR_ROLES);

        if (error) {
            return { authorized: false, error: error.message };
        }

        return {
            authorized: chairRoles && chairRoles.length > 0
        };
    } catch (error) {
        return {
            authorized: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
