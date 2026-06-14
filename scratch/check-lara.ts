import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const { data: matricula, error: mError } = await supabase
    .from('matriculas')
    .select('*')
    .eq('id', '4e3547e8-86a7-4aad-b569-e84a472dd2a3')
    .single();

  if (mError) {
    console.error('Error fetching matricula:', mError);
  } else {
    console.log('Matricula:', matricula);
  }
}
run();
