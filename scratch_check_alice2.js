import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase
    .from('aulas_experimentais')
    .select('id, aluno_id, responsavel1, whatsapp1, unidade, turma_escolar, curso')
    .limit(10)
    .order('created_at', { ascending: false });
    
  console.log(error || data);
}
test();
