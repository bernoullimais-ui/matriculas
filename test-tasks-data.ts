import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const keyToUse = supabaseServiceRoleKey || supabaseAnonKey;
const supabase = createClient(supabaseUrl, keyToUse);

async function run() {
  const { data, error } = await supabase.from('tarefas').select('*').limit(5);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success:', JSON.stringify(data, null, 2));
  }
}
run();
