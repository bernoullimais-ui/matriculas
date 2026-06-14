import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error('Error listing users:', error);
  } else {
    console.log('Total users:', users.length);
    for (const u of users) {
      console.log(`Email: ${u.email}, ID: ${u.id}`);
      console.log('Metadata:', JSON.stringify(u.user_metadata, null, 2));
      console.log('---');
    }
  }
}
run();
