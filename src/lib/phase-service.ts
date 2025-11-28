// src/lib/phaseService.ts
import { createClient } from "@/utils/supabase/server";
import { cookies } from 'next/headers';

export interface PhaseInfo {
    phase: 'inactive' | 'maincomm_interviews' | 'maincomm_concurrent_ranking' |
    'maincomm_results_processing' | 'maincomm_results_available' |
    'subcomm_interviews' | 'subcomm_concurrent_ranking' |
    'subcomm_results_processing' | 'full_results_available';
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
    isTestingMode?: boolean;
}

interface DatabaseFlag {
    name: string;
    expires_at: string;
}

export class PhaseService {
    // ✅ TESTING OVERRIDE - Change this line to test different phases
    private getTestingPhaseOverride(): string | null {
        // 🧪 TESTING: Uncomment one line below to test different phases
        // return 'inactive';
        // return 'maincomm_interviews_test';
        // return 'maincomm_concurrent_ranking_test';
        // return 'maincomm_results_processing_test';
        // return 'maincomm_results_available_test';
        // return 'subcomm_interviews_test';
        return 'subcomm_concurrent_ranking_test';
        // return 'subcomm_results_processing_test';
        return 'full_results_available_test';
        return null; // ✅ Default: no override (uses real database phases)
    }

    private getServerTime(): Date {
        return new Date();
    }

    private async getNextPhaseInfo(): Promise<{ nextPhase: string; nextPhaseDate: string } | null> {
        try {
            const supabase = await createClient();
            const { data: flags, error } = await supabase
                .from('feature_flags')
                .select('name, expires_at')
                .gt('expires_at', new Date().toISOString())
                // .eq('enabled', true)
                .order('expires_at', { ascending: true })
                .limit(1);

            if (error || !flags || flags.length === 0) {
                return null;
            }

            const nextFlag = flags[0];
            const nextPhaseDate = new Date(nextFlag.expires_at);
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
            const supabase = await createClient();
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

            // ✅ NEW: MainComm Interviews
            if (activeFlags.includes('maincomm_interviews_test') || activeFlags.includes('maincomm_interviews')) {
                return {
                    phase: 'maincomm_interviews',
                    round: 'maincomm',
                    allowChairRanking: false,
                    allowApplicantRanking: false,
                    showResults: false,
                    userMessage: 'MainComm interviews are currently in progress.',
                    nextPhaseDate: nextPhaseInfo?.nextPhaseDate,
                    serverTime: serverTime.toISOString(),
                    activeFlags
                };
            }

            // ✅ NEW: MainComm Concurrent Ranking (Both students and chairs can rank)
            if (activeFlags.includes('maincomm_concurrent_ranking_test') || activeFlags.includes('maincomm_concurrent_ranking')) {
                return {
                    phase: 'maincomm_concurrent_ranking',
                    round: 'maincomm',
                    allowChairRanking: true,  // ✅ Chairs can rank applicants
                    allowApplicantRanking: true,  // ✅ Students can apply and rank positions
                    showResults: false,
                    userMessage: 'MainComm applications are open! Students can apply to positions while chairs rank applicants.',
                    nextPhaseDate: nextPhaseInfo?.nextPhaseDate,
                    serverTime: serverTime.toISOString(),
                    activeFlags
                };
            }

            // ✅ MainComm Results Processing
            if (activeFlags.includes('maincomm_results_processing_test') || activeFlags.includes('maincomm_results_processing')) {
                return {
                    phase: 'maincomm_results_processing',
                    round: 'maincomm',
                    allowChairRanking: false,
                    allowApplicantRanking: false,
                    showResults: false,
                    userMessage: 'MainComm results are being processed. Please wait.',
                    nextPhaseDate: nextPhaseInfo?.nextPhaseDate,
                    serverTime: serverTime.toISOString(),
                    activeFlags
                };
            }

            // ✅ MainComm Results Available
            if (activeFlags.includes('maincomm_results_available_test') || activeFlags.includes('maincomm_results_available')) {
                return {
                    phase: 'maincomm_results_available',
                    round: 'maincomm',
                    allowChairRanking: false,
                    allowApplicantRanking: false,
                    showResults: true,
                    showMaincommResults: true,
                    showSubcommResults: false,
                    userMessage: 'MainComm results are available! SubComm interviews starting soon.',
                    nextPhaseDate: nextPhaseInfo?.nextPhaseDate,
                    serverTime: serverTime.toISOString(),
                    activeFlags
                };
            }

            // ✅ NEW: SubComm Interviews
            if (activeFlags.includes('subcomm_interviews_test') || activeFlags.includes('subcomm_interviews')) {
                return {
                    phase: 'subcomm_interviews',
                    round: 'subcomm',
                    allowChairRanking: false,
                    allowApplicantRanking: false,
                    showResults: true,
                    showMaincommResults: true,
                    showSubcommResults: false,
                    userMessage: 'SubComm interviews are in progress. MainComm results remain available.',
                    nextPhaseDate: nextPhaseInfo?.nextPhaseDate,
                    serverTime: serverTime.toISOString(),
                    activeFlags
                };
            }

            // ✅ NEW: SubComm Concurrent Ranking (Both students and chairs can rank)
            if (activeFlags.includes('subcomm_concurrent_ranking_test') || activeFlags.includes('subcomm_concurrent_ranking')) {
                return {
                    phase: 'subcomm_concurrent_ranking',
                    round: 'subcomm',
                    allowChairRanking: true,  // ✅ Chairs can rank applicants
                    allowApplicantRanking: true,  // ✅ Students can apply and rank positions
                    showResults: true,
                    showMaincommResults: true,
                    showSubcommResults: false,
                    userMessage: 'SubComm applications are open! Students can apply to positions while chairs rank applicants.',
                    nextPhaseDate: nextPhaseInfo?.nextPhaseDate,
                    serverTime: serverTime.toISOString(),
                    activeFlags
                };
            }

            // ✅ SubComm Results Processing
            if (activeFlags.includes('subcomm_results_processing_test') || activeFlags.includes('subcomm_results_processing')) {
                return {
                    phase: 'subcomm_results_processing',
                    round: 'subcomm',
                    allowChairRanking: false,
                    allowApplicantRanking: false,
                    showResults: true,
                    showMaincommResults: true,
                    showSubcommResults: false,
                    userMessage: 'SubComm results are being processed. MainComm results remain available.',
                    nextPhaseDate: nextPhaseInfo?.nextPhaseDate,
                    serverTime: serverTime.toISOString(),
                    activeFlags
                };
            }

            // ✅ Full Results Available
            if (activeFlags.includes('full_results_available_test') || activeFlags.includes('full_results_available')) {
                return {
                    phase: 'full_results_available',
                    round: 'complete',
                    allowChairRanking: false,
                    allowApplicantRanking: false,
                    showResults: true,
                    showMaincommResults: true,
                    showSubcommResults: true,
                    userMessage: 'All CCA allocation results are now available!',
                    nextPhaseDate: nextPhaseInfo?.nextPhaseDate,
                    serverTime: serverTime.toISOString(),
                    activeFlags
                };
            }

            // Default: Inactive
            return {
                phase: 'inactive',
                round: 'inactive',
                allowChairRanking: false,
                allowApplicantRanking: false,
                showResults: false,
                userMessage: 'CCA allocation is currently not active.',
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
