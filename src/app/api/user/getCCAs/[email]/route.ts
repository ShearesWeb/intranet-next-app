import { NextResponse } from "next/server";
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

// ✅ Proper TypeScript interfaces with union types
interface CCAData {
	name: string;
	cca_type: string;
	description: string;
	image_url: string | null;
}

interface PositionData {
	id: number;
	name: string;
	position_type: string;
	cca_id: number;
	ccas: CCAData | CCAData[];
}

interface AppointmentData {
	position_id: number;
	points: number;
}

// ✅ Type-safe helper function with proper type guards
function getCCAProperty(cca: CCAData | CCAData[], property: keyof CCAData): string {
	if (Array.isArray(cca)) {
		// Handle array case
		return cca.length > 0 ? (cca[0][property] as string) || 'Unknown' : 'Unknown';
	} else if (cca && typeof cca === 'object') {
		// Handle object case
		return (cca[property] as string) || 'Unknown';
	}
	return 'Unknown';
}

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
			return NextResponse.json({ data: [] });
		}

		// Step 1: Get user ID from public_users table
		const { data: userData, error: userError } = await supabase
			.from('public_users')
			.select('id')
			.eq('email', email)
			.single();

		if (userError || !userData) {
			console.log("User not found in public_users:", email, userError);
			return NextResponse.json({ data: [] });
		}

		// console.log("User found with ID:", userData.id);

		// Step 2: Get appointments for this user
		const { data: appointments, error: appointmentError } = await supabase
			.from('cca_appointments')
			.select('position_id, points')
			.eq('user_id', userData.id);

		if (appointmentError) {
			console.error("Error fetching appointments:", appointmentError);
			return NextResponse.json({ data: [] });
		}

		// console.log("Appointments found:", appointments);

		if (!appointments || appointments.length === 0) {
			return NextResponse.json({ data: [] });
		}

		// Step 3: Get position details for these appointments
		const positionIds = appointments.map((app: AppointmentData) => app.position_id);

		const { data: positions, error: positionError } = await supabase
			.from('cca_positions')
			.select(`
                id,
                name,
                position_type,
                cca_id,
                ccas!inner(name, cca_type, description, image_url)
            `)
			.in('id', positionIds);

		if (positionError) {
			console.error("Error fetching positions:", positionError);
			return NextResponse.json({ data: [] });
		}

		// console.log("Positions found:", positions);

		// Step 4: Combine the data - ✅ Type-safe transformation
		const transformedData = appointments
			.map((appointment: AppointmentData) => {
				const position = positions?.find(
					(p: PositionData) => p.id === appointment.position_id
				) as PositionData | undefined;

				if (!position) return null;

				return {
					name: getCCAProperty(position.ccas, 'name'),
					role: position.name || 'Unknown Role',
					position_type: position.position_type,
					cca_type: getCCAProperty(position.ccas, 'cca_type'),
					description: getCCAProperty(position.ccas, 'description'),
					points: appointment.points || 0
				};
			})
			.filter((item): item is NonNullable<typeof item> => item !== null);

		// console.log("Final transformed data:", transformedData);

		return NextResponse.json({
			data: transformedData,
			debug: {
				userFound: !!userData,
				appointmentsCount: appointments?.length || 0,
				positionsCount: positions?.length || 0,
				email: email
			}
		});

	} catch (error) {
		console.error("Error fetching user CCAs:", error);
		return NextResponse.json({ data: [] });
	}
}
