import { NextResponse } from 'next/server'; 
import { adminAuth } from '../../../../../lib/firebase-admin-config';


export async function POST(request : Request) {
    try {
        const { email } = await request.json();
        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
          }
          const userRecord = await adminAuth.getUserByEmail(email);
         
          return NextResponse.json({ user: userRecord.toJSON()});
    } catch (error) {
            console.error('Error fetching user data:', error);
            return NextResponse.json({ error: 'Error fetching user data' }, { status: 500 });
    }
}