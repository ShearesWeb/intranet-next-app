// src\app\api\user\getCCAs\[email]\route.ts
import { NextResponse } from "next/server";
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ email: string }> }
) {
	try {
		const { email } = await params;
		const supabase = createRouteHandlerClient({ cookies });

		// Get user's CCA appointments with CCA details
		const { data: userData, error } = await supabase
			.from('users')
			.select(`
        id,
        cca_appointments (
          appointment_type,
          points,
          ccas (
            name,
            cca_type,
            description,
            image_url
          )
        )
      `)
			.eq('email', email)
			.single();

		// Handle user not found gracefully
		if (error || !userData) {
			console.log("User not found in database:", email);
			return NextResponse.json({ data: [] }); // Return empty array instead of error
		}

		// Transform data to match expected frontend format
		const transformedData = userData.cca_appointments.map((appointment: any) => ({
			name: appointment.ccas.name,
			role: appointment.appointment_type,
			cca_type: appointment.ccas.cca_type,
			description: appointment.ccas.description,
			points: appointment.points || 0
		}));

		return NextResponse.json({ data: transformedData });

	} catch (error) {
		console.error("Error fetching user CCAs:", error);
		return NextResponse.json({ data: [] }); // Return empty array on error
	}
}