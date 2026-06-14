import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: cols } = await supabase.rpc('get_columns', { table_name: 'pagamentos' });
  console.log("Cols via RPC?:", cols);
  
  // if RPC fails, just query 1 row to see keys
  const { data: row } = await supabase.from('pagamentos').select('*').limit(1);
  if (row && row.length > 0) {
    console.log("Keys in pagamentos table:", Object.keys(row[0]));
  }
}
check();
