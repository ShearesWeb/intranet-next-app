import { supabase } from '../../lib/supabase';

// Sample data for users to insert
const users = [
  {
    email: 'john.doe@example.com',
    full_name: 'John Doe',
    room: 'A101',
    points: 100,
  },
  {
    email: 'jane.smith@example.com',
    full_name: 'Jane Smith',
    room: 'B202',
    points: 150,
  }
];

async function insertUsers() {
  try {
    const { data, error } = await supabase
      .from('Users') 
      .insert(users);

    if (error) {
      console.error('Error inserting users:', error);
    } else {
      console.log('Users inserted successfully:', data);
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}


insertUsers();