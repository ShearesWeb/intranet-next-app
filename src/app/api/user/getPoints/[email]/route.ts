// src/app/api/user/getPoints/[email]/route.ts

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

		const { data: { user }, error: authError } = await supabase.auth.getUser();

		if (authError || !user) {
			console.log("No authenticated user for request:", authError);
			return NextResponse.json({ userPoints: 0 });
		}

		const { data: userData, error: userError } = await supabase
			.from('users')
			.select('id, points')
			.eq('email', email)
			.single();

		if (userError) {
			console.log("Database error:", userError);
			return NextResponse.json({ userPoints: 0 });
		}

		if (!userData) {
			console.log("User not found in database:", email);
			return NextResponse.json({ userPoints: 0 });
		}

		const userPoints = userData.points || 0;
		console.log("User points found:", userPoints);
		return NextResponse.json({ userPoints });

	} catch (error) {
		console.error("Error fetching user points:", error);
		return NextResponse.json({ userPoints: 0 });
	}
}
