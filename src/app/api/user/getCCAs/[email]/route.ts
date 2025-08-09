// src/app/api/user/getCCAs/[email]/route.ts
import { NextResponse } from "next/server";
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

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

		// Authentication check
		const { data: { user }, error: authError } = await supabase.auth.getUser();
		if (authError || !user) {
			console.log("No authenticated user for request:", authError);
			return NextResponse.json({ data: [] });
		}

		const { data: userData, error: userError } = await supabase
			.from('public_users')
			.select(`
                id,
                email,
                cca_appointments (
                    points,
                    cca_positions (
                        name,
                        position_type,
                        ccas (
                            name,
                            cca_type,
                            description,
                            image_url
                        )
                    )
                )
            `)
			.eq('email', email)
			.single();

		// Handle user not found gracefully
		if (userError || !userData) {
			console.log("User not found in database:", email, userError);
			return NextResponse.json({ data: [] }); // Return empty array instead of error
		}

		// ✅ FIXED: Transform data to match expected frontend format
		const transformedData = userData.cca_appointments?.map((appointment: any) => ({
			name: appointment.cca_positions?.ccas?.name || 'Unknown CCA',
			role: appointment.cca_positions?.name || 'Unknown Role',
			cca_type: appointment.cca_positions?.ccas?.cca_type || 'Unknown Type',
			description: appointment.cca_positions?.ccas?.description || 'No description available',
			points: appointment.points || 0
		})) || [];

		return NextResponse.json({
			data: transformedData,
			debug: {
				userFound: !!userData,
				appointmentsCount: userData.cca_appointments?.length || 0,
				email: email
			}
		});

	} catch (error) {
		console.error("Error fetching user CCAs:", error);
		return NextResponse.json({ data: [] });
	}
}
