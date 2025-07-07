import { NextResponse } from 'next/server'; 
import { adminAuth } from '../../../../../lib/firebase-admin-config';
import { supabase } from '../../../../../lib/supabase';

const USER_TABLE_NAME = 'Users';

export async function POST(request : Request) {
    try {
        const { email } = await request.json();
        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
          }
          const userRecord = await adminAuth.getUserByEmail(email);
          console.log('Supabase Key:', process.env.SUPABASE_KEY);    
          const {data, error} = await supabase.from(USER_TABLE_NAME).select("*")
          if (error) {
            console.log("ERROR" + error);
          }
          console.log(data);
          return NextResponse.json({ user: userRecord.toJSON()});
    } catch (error) {
            console.error('Error fetching user data:', error);
            return NextResponse.json({ error: 'Error fetching user data' }, { status: 500 });
    }
}