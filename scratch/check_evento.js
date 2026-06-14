import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('evento_inscricoes').select('*').eq('id', '98edbddf-8898-4421-97df-c3b802d96a4f');
  console.log("Inscricao:", data, error);
}
run();
