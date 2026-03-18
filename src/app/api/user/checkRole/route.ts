// src/app/api/user/checkRole/route.ts
// API route to check if a user has lead/vice roles and return their positions
import { NextResponse } from "next/server";
import { fetchUserInfo } from "@/lib/fetch-user-info";
import { checkCcaAuthorization } from '@/lib/cca-chair-access';
import { isCoreServiceEnabled } from "@/lib/feature-flags";

type UserPositionSummary = {
    position: string;
    position_type: string;
    cca: string;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: Request) {
    try {
        const headers = {
            'Cache-Control': 'no-store, private',
            'Content-Type': 'application/json',
        };

        if (!isCoreServiceEnabled("ccaApplications")) {
            return NextResponse.json({ isAuthorized: false, positions: [] }, { headers });
        }

        // Get full user info to check admin status
        const userInfo = await fetchUserInfo();

        if (!userInfo) {
            return NextResponse.json({
                isAuthorized: false,
                positions: []
            }, {
                status: 401,
                headers
            });
        }

        const authResult = checkCcaAuthorization({ requestingUser: userInfo });
        const userPositions: UserPositionSummary[] = (userInfo.appointments || []).map((appointment) => ({
            position: appointment.position_name,
            position_type: appointment.position_type,
            cca: appointment.cca_name || 'Unknown',
        }));
        const roleResult = {
            isAuthorized: authResult.ok && authResult.data.hasChairAccess,
            positions: userPositions.map((pos) => `${pos.position} (${pos.position_type}) - ${pos.cca}`)
        };

        // Allow admins to access chair features
        if (userInfo.is_admin) {
            roleResult.isAuthorized = true;
            if (roleResult.positions.length === 0) {
                roleResult.positions.push("Administrator Access");
            }
        }

        return NextResponse.json(roleResult, { headers });

    } catch (error) {
        console.error("Error checking role:", error);
        return NextResponse.json({ isAuthorized: false, positions: [] }, {
            headers: {
                'Cache-Control': 'no-store, private',
                'Content-Type': 'application/json',
            }
        });
    }
}
