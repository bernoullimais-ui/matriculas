import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_ANON_KEY || '');

async function test() {
  const { data, error } = await supabase.rpc('get_column_info'); // Let's just do a normal query to fetch 1 row
  const { data: row } = await supabase.from('aulas_experimentais').select('id').limit(1);
  console.log("Row:", row);
}
test();
