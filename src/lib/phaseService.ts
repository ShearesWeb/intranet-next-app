// src/lib/phaseService.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export interface PhaseInfo {
    phase: 'inactive' | 'maincomm_interviews' | 'chair_ranking_maincomm' | 'applicant_ranking_maincomm' |
    'maincomm_results_processing' | 'maincomm_results_available' | 'subcomm_interviews' |
    'chair_ranking_subcomm' | 'applicant_ranking_subcomm' | 'subcomm_results_processing' |
    'full_results_available';
    round: 'maincomm' | 'subcomm' | 'complete' | 'inactive';
    allowChairRanking: boolean;
    allowApplicantRanking: boolean;
    showResults: boolean;
    showMaincommResults?: boolean;
    showSubcommResults?: boolean;
    userMessage: string;
    nextPhaseDate?: string;
    serverTime: string;
    activeFlags: string[];
}

// ✅ ADD: Interface for database flag
interface DatabaseFlag {
    name: string;
    expires_at: string;
}

export class PhaseService {
    private createSupabaseClient() {
        const getCookies = () => cookies();
        return createRouteHandlerClient({
            cookies: getCookies
        });
    }

    // ✅ SIMPLE TESTING OVERRIDE - Just change this line to test different phases
    private getTestingPhaseOverride(): string | null {
        // 🧪 TESTING: Uncomment one line below to test different phases
        // return 'inactive';
        // return 'maincomm_interviews_test';
        return 'chair_ranking_maincomm_test';
        // return 'applicant_ranking_maincomm_test';
        // return 'maincomm_results_processing_test';
        // return 'maincomm_results_available_test';
        // return 'subcomm_interviews_test';
        // return 'chair_ranking_subcomm_test';
        // return 'applicant_ranking_subcomm_test';
        // return 'subcomm_results_processing_test';
        // return 'full_results_available_test';
        // return null; // ✅ Default: no override (uses real database phases)
    }

    private getServerTime(): Date {
        return new Date();
    }

    // ✅ FIXED: Get next phase information with proper supabase usage
    private async getNextPhaseInfo(): Promise<{ nextPhase: string; nextPhaseDate: string } | null> {
        try {
            const supabase = this.createSupabaseClient();
            const { data: flags, error } = await supabase
                .from('feature_flags')
                .select('name, expires_at')
                .gt('expires_at', new Date().toISOString())
                .order('expires_at', { ascending: true })
                .limit(1);

            if (error || !flags || flags.length === 0) {
                return null;
            }

            const nextFlag = flags[0];
            const nextPhaseDate = new Date(nextFlag.expires_at);

            // Format as readable date/time
            const formattedDate = nextPhaseDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short'
            });

            return {
                nextPhase: nextFlag.name,
                nextPhaseDate: formattedDate
            };
        } catch (error) {
            console.error('Error getting next phase info:', error);
            return null;
        }
    }

    async getCurrentPhaseInfo(): Promise<PhaseInfo> {
        try {
            const supabase = this.createSupabaseClient();
            const serverTime = this.getServerTime();
            const nextPhaseInfo = await this.getNextPhaseInfo();

            // Check for testing override first (dev only)
            const testingOverride = process.env.NODE_ENV === 'development' ? this.getTestingPhaseOverride() : null;
            let activeFlags: string[] = [];

            if (testingOverride) {
                activeFlags = [testingOverride];
                console.log(`🧪 Testing Mode: Using phase override: ${testingOverride}`);
            } else {
                // Get real active phases from database
                const { data: flags, error } = await supabase
                    .from('feature_flags')
                    .select('name, expires_at')
                    .order('expires_at', { ascending: true });

                if (!error && flags) {
                    activeFlags = flags
                        .filter((flag: DatabaseFlag) => new Date(flag.expires_at) >= serverTime)
                        .map((flag: DatabaseFlag) => flag.name);
                }
            }

            // All your existing phase logic remains the same...
            if (activeFlags.includes('maincomm_interviews_test') || activeFlags.includes('maincomm_interviews')) {
                return {
                    phase: 'maincomm_interviews',
                    round: 'maincomm',
                    allowChairRanking: false,
                    allowApplicantRanking: false,
                    showResults: false,
                    userMessage: 'Maincomm interviews are currently in progress.',
                    nextPhaseDate: nextPhaseInfo?.nextPhaseDate,
                    serverTime: serverTime.toISOString(),
                    activeFlags
                };
            }

            if (activeFlags.includes('chair_ranking_maincomm_test') || activeFlags.includes('chair_ranking_maincomm')) {
                return {
                    phase: 'chair_ranking_maincomm',
                    round: 'maincomm',
                    allowChairRanking: true,
                    allowApplicantRanking: false,
                    showResults: false,
                    userMessage: 'Chairs are currently ranking maincomm applicants.',
                    nextPhaseDate: nextPhaseInfo?.nextPhaseDate,
                    serverTime: serverTime.toISOString(),
                    activeFlags
                };
            }

            if (activeFlags.includes('applicant_ranking_maincomm_test') || activeFlags.includes('applicant_ranking_maincomm')) {
                return {
                    phase: 'applicant_ranking_maincomm',
                    round: 'maincomm',
                    allowChairRanking: false,
                    allowApplicantRanking: true,
                    showResults: false,
                    userMessage: 'Rank your preferred maincomm positions now!',
                    nextPhaseDate: nextPhaseInfo?.nextPhaseDate,
                    serverTime: serverTime.toISOString(),
                    activeFlags
                };
            }

            if (activeFlags.includes('maincomm_results_processing_test') || activeFlags.includes('maincomm_results_processing')) {
                return {
                    phase: 'maincomm_results_processing',
                    round: 'maincomm',
                    allowChairRanking: false,
                    allowApplicantRanking: false,
                    showResults: false,
                    userMessage: 'Maincomm results are being processed. Please wait.',
                    nextPhaseDate: nextPhaseInfo?.nextPhaseDate,
                    serverTime: serverTime.toISOString(),
                    activeFlags
                };
            }

            if (activeFlags.includes('maincomm_results_available_test') || activeFlags.includes('maincomm_results_available')) {
                return {
                    phase: 'maincomm_results_available',
                    round: 'maincomm',
                    allowChairRanking: false,
                    allowApplicantRanking: false,
                    showResults: true,
                    showMaincommResults: true,
                    showSubcommResults: false,
                    userMessage: 'Maincomm allocation results are now available! Subcomm phase starts soon.',
                    nextPhaseDate: nextPhaseInfo?.nextPhaseDate,
                    serverTime: serverTime.toISOString(),
                    activeFlags
                };
            }

            if (activeFlags.includes('subcomm_interviews_test') || activeFlags.includes('subcomm_interviews')) {
                return {
                    phase: 'subcomm_interviews',
                    round: 'subcomm',
                    allowChairRanking: false,
                    allowApplicantRanking: false,
                    showResults: true,
                    showMaincommResults: true,
                    showSubcommResults: false,
                    userMessage: 'Subcomm interviews are currently in progress. Maincomm results remain available.',
                    nextPhaseDate: nextPhaseInfo?.nextPhaseDate,
                    serverTime: serverTime.toISOString(),
                    activeFlags
                };
            }

            if (activeFlags.includes('chair_ranking_subcomm_test') || activeFlags.includes('chair_ranking_subcomm')) {
                return {
                    phase: 'chair_ranking_subcomm',
                    round: 'subcomm',
                    allowChairRanking: true,
                    allowApplicantRanking: false,
                    showResults: false,
                    userMessage: 'Chairs are currently ranking subcomm applicants.',
                    nextPhaseDate: nextPhaseInfo?.nextPhaseDate,
                    serverTime: serverTime.toISOString(),
                    activeFlags
                };
            }

            if (activeFlags.includes('applicant_ranking_subcomm_test') || activeFlags.includes('applicant_ranking_subcomm')) {
                return {
                    phase: 'applicant_ranking_subcomm',
                    round: 'subcomm',
                    allowChairRanking: false,
                    allowApplicantRanking: true,
                    showResults: false,
                    userMessage: 'Rank your preferred subcomm positions now!',
                    nextPhaseDate: nextPhaseInfo?.nextPhaseDate,
                    serverTime: serverTime.toISOString(),
                    activeFlags
                };
            }

            if (activeFlags.includes('subcomm_results_processing_test') || activeFlags.includes('subcomm_results_processing')) {
                return {
                    phase: 'subcomm_results_processing',
                    round: 'subcomm',
                    allowChairRanking: false,
                    allowApplicantRanking: false,
                    showResults: true,
                    showMaincommResults: true,
                    showSubcommResults: false,
                    userMessage: 'Subcomm results are being processed. Maincomm results remain available.',
                    nextPhaseDate: nextPhaseInfo?.nextPhaseDate,
                    serverTime: serverTime.toISOString(),
                    activeFlags
                };
            }

            if (activeFlags.includes('full_results_available_test') || activeFlags.includes('full_results_available')) {
                return {
                    phase: 'full_results_available',
                    round: 'complete',
                    allowChairRanking: false,
                    allowApplicantRanking: false,
                    showResults: true,
                    showMaincommResults: true,
                    showSubcommResults: true,
                    userMessage: 'Final CCA allocation results are now available!',
                    nextPhaseDate: nextPhaseInfo?.nextPhaseDate,
                    serverTime: serverTime.toISOString(),
                    activeFlags
                };
            }

            return {
                phase: 'inactive',
                round: 'inactive',
                allowChairRanking: false,
                allowApplicantRanking: false,
                showResults: false,
                userMessage: 'CCA allocation is not currently active.',
                nextPhaseDate: nextPhaseInfo?.nextPhaseDate,
                serverTime: serverTime.toISOString(),
                activeFlags
            };

        } catch (error) {
            console.error('Error getting current phase info:', error);
            return {
                phase: 'inactive',
                round: 'inactive',
                allowChairRanking: false,
                allowApplicantRanking: false,
                showResults: false,
                userMessage: 'Error determining current phase.',
                serverTime: this.getServerTime().toISOString(),
                activeFlags: []
            };
        }
    }
}

export const phaseService = new PhaseService();
