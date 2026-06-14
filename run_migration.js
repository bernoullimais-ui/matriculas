import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = fs.readFileSync('supabase/migrations/20260608000006_update_solicitacoes.sql', 'utf8');
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  console.log("Result:", data);
  if (error) console.error("Error:", error);
}
run();
