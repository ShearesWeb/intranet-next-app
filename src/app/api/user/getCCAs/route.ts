// src/app/api/user/getCCAs/route.ts
// API route to get CCAs a user is appointed to
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchUserId } from "@/lib/fetch-user-info";

// ✅ TypeScript interfaces with union types
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

export async function GET(request: Request) {
	try {
		const supabase = await createClient();

		// Get user ID from cookie
		const userId = await fetchUserId();

		if (!userId) {
			return NextResponse.json({
				error: 'Unauthorized'
			}, { status: 401 });
		}

		// Step 2: Get appointments for this user
		const { data: appointments, error: appointmentError } = await supabase
			.from('cca_appointments')
			.select('position_id')
			.eq('user_id', userId);

		if (appointmentError) {
			console.error("Error fetching appointments:", appointmentError);
			return NextResponse.json({ data: [] });
		}

		// console.log("Appointments found:", appointments);

		if (!appointments || appointments.length === 0) {
			return NextResponse.json({ data: [] });
		}

		// Step 3: Get position details for these appointments
		const positionIds = appointments.map((app: any) => app.position_id);

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
			.map((appointment: any) => {
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
				userId: userId,
				appointmentsCount: appointments?.length || 0,
				positionsCount: positions?.length || 0
			}
		});

	} catch (error) {
		console.error("Error fetching user CCAs:", error);
		return NextResponse.json({ data: [] });
	}
}
