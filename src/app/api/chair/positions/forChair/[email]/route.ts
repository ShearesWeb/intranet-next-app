// src/app/api/chair/positions/for-chair/[email]/route.ts

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ email: string }> }
) {

    try {
        const { email } = await params;

        const getCookies = () => cookies();
        const supabase = createRouteHandlerClient({
            cookies: getCookies
        });

        // Step 0: Authentication verification
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError) {
            return NextResponse.json({ positions: [] });
        }

        if (!user) {
            return NextResponse.json({ positions: [] });
        }

        // Step 1: Lookup user in database
        const { data: userData, error: userError } = await supabase
            .from("public_users")
            .select("id, email")
            .eq("email", email)
            .single();

        if (userError) {
            return NextResponse.json({ positions: [] });
        }

        if (!userData) {
            return NextResponse.json({ positions: [] });
        }

        // Step 2: Find appointments
        const authorizedRoles = ["lead", "vice"];
        const { data: chairAppointments, error: appointmentError } = await supabase
            .from("cca_appointments")
            .select(`
                id,
                user_id,
                position_id,
                cca_positions!inner(
                    id,
                    name,
                    position_type, 
                    cca_id, 
                    ccas(id, name)
                )
            `)
            .eq("user_id", userData.id);

        if (appointmentError) {
            return NextResponse.json({ positions: [] });
        }

        // Process appointments
        const ccasSet = new Set<number>();
        const authorizedAppointments: any[] = [];

        (chairAppointments || []).forEach((appointment: any, index: number) => {
            if (appointment.cca_positions) {
                const positionType = (appointment.cca_positions.position_type || "").toLowerCase();

                if (authorizedRoles.includes(positionType)) {
                    ccasSet.add(appointment.cca_positions.cca_id);
                    authorizedAppointments.push(appointment);
                }
            }
        });

        if (!ccasSet.size) {
            return NextResponse.json({ positions: [] });
        }

        // Step 3: Get positions
        const { data: allPositions, error: posError } = await supabase
            .from("cca_positions")
            .select("id, name, capacity, position_type, cca_id, ccas(id, name)")
            .in("cca_id", Array.from(ccasSet))
            .gt("capacity", 0)
            .not('position_type', 'in', '("lead","vice")');

        if (posError) {
            return NextResponse.json({ positions: [] });
        }

        if (!allPositions || allPositions.length === 0) {
            return NextResponse.json({ positions: [] });
        }

        // Step 4: Get applicants for each position
        const positionsWithApplicants = await Promise.all(
            allPositions.map(async (position: any) => {
                // First, get applications with user IDs
                const { data: applications, error: appErr } = await supabase
                    .from("user_cca_applications")
                    .select("user_id, ranking")
                    .eq("position_id", position.id);

                if (appErr) {
                    console.error(`Error fetching applicants for position ${position.id}:`, appErr);
                    return null;
                }

                // Then, get user details from public_users table
                const applicants = [];
                for (const app of applications || []) {
                    const { data: userData, error: userErr } = await supabase
                        .from("public_users")
                        .select("id, name, email, room")
                        .eq("id", app.user_id)
                        .single();

                    if (!userErr && userData) {
                        applicants.push({
                            id: userData.id,
                            name: userData.name,
                            email: userData.email,
                            room: userData.room,
                            ranking: app.ranking,
                        });
                    }
                }

                // Sort by ranking
                applicants.sort((a, b) => {
                    if (a.ranking == null) return 1;
                    if (b.ranking == null) return -1;
                    return a.ranking - b.ranking;
                });

                return {
                    id: position.id,
                    name: position.name,
                    cca_name: position.ccas?.name ?? "Unknown",
                    capacity: position.capacity,
                    position_type: position.position_type,
                    applicants,
                };
            })
        );

        // Remove null positions and log final result
        const validPositions = positionsWithApplicants.filter((p) => p !== null);

        return NextResponse.json({ positions: validPositions });

    } catch (error) {
        console.error("DEBUG: Unexpected error in forChair API:", error);
        console.error("DEBUG: Error stack:", error instanceof Error ? error.stack : 'No stack trace');
        return NextResponse.json({ positions: [] });
    }
}
