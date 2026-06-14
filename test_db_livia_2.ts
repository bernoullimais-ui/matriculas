import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: matriculas } = await supabase.from('matriculas').select('*').eq('aluno_id', 'b27b50a6-b0c0-4c00-9130-74326b8e87e4');
  console.log("Matriculas:", JSON.stringify(matriculas, null, 2));
}
check();
