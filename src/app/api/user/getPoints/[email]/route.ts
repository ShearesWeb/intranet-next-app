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

		// Get user by email to get their ID
		const { data: user, error: userError } = await supabase
			.from('users')
			.select('id, points')
			.eq('email', email)
			.single();

		// Handle user not found gracefully
		if (userError || !user) {
			console.log("User not found in database:", email);
			return NextResponse.json({ userPoints: 0 }); // Return 0 points instead of error
		}

		// Return the points from the users table
		const userPoints = user.points || 0;	

		console.log("User points:", userPoints);
		return NextResponse.json({ userPoints });

	} catch (error) {
		console.error("Error fetching user points:", error);
		return NextResponse.json({ userPoints: 0 }); // Return 0 points on error
	}
}
