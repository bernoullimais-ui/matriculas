import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase
    .from('turmas')
    .select('id, nome, unidade_nome')
    .ilike('nome', '%Funcional%');
    
  console.log(error || data);
}
test();
