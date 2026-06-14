import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'PRESENT' : 'MISSING');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'PRESENT' : 'MISSING');
const supabase = createClient(process.env.SUPABASE_URL || 'https://dummy.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'dummy-key');
async function run() {
  if (!process.env.SUPABASE_URL) {
    console.error('SUPABASE_URL is missing in environment!');
    return;
  }
  console.log('Testing tarefas table...');
  const { data, error } = await supabase.from('tarefas').select('*').limit(1);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success:', data);
  }
}
run();
