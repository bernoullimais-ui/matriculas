import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function check() {
  const { data, error } = await supabase
    .from('matriculas')
    .select('aluno_id, turma, unidade, alunos(responsavel_id)')
    .eq('id', 'ef6b8c5c-f8b9-49b3-85d6-3926e92167bf')
    .single();
  console.log(data, error);
}
check();
