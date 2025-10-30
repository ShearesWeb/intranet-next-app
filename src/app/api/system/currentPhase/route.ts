// src/app/api/system/currentPhase/route.ts
// API route to get the current system phase information
import { NextResponse } from 'next/server';
import { phaseService } from '@/lib/phase-service';

export async function GET() {
    try {
        const phaseInfo = await phaseService.getCurrentPhaseInfo();

        return NextResponse.json({
            ...phaseInfo,
            timestamp: new Date().toISOString(),
            isTestingMode: process.env.NODE_ENV === 'development'
        }, {
            headers: {
                'Cache-Control': 'private, s-maxage=30, stale-while-revalidate=60',
                'Content-Type': 'application/json',
            }
        });
    } catch (error) {
        console.error('Error getting current phase:', error);
        return NextResponse.json({
            phase: 'inactive',
            round: 'inactive',
            allowChairRanking: false,
            allowApplicantRanking: false,
            showResults: false,
            userMessage: 'Error determining current phase',
            serverTime: new Date().toISOString(),
            activeFlags: [],
            error: 'Failed to determine current phase'
        }, {
            status: 500,
            headers: {
                'Cache-Control': 'no-cache',
                'Content-Type': 'application/json',
            }
        });
    }
}
