import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: eventos, error } = await supabase.from('eventos').select('*').limit(1);
  if (error) console.error(error);
  else console.log(eventos);
}
run();
