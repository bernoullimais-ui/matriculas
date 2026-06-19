import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('alunos').select('id, nome_completo, responsavel_id, responsavel_1, cpf_responsavel').limit(5);
  console.log(data);
  const { count } = await supabase.from('alunos').select('*', { count: 'exact', head: true }).is('responsavel_id', null);
  console.log('Students with null responsavel_id:', count);
}
check();
