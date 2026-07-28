import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data: lead } = await supabase
    .from('leads_atendimento')
    .select('*')
    .ilike('nome_aluno', '%Andrei%');
  console.log('Leads:', lead);
}
run();
