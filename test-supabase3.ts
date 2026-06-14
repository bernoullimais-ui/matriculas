import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data, error } = await supabase.from('matriculas')
    .select('id, aluno_id, alunos(nome_completo), turma')
    .limit(1);
  console.log("matriculas:", data);
  if (error) console.log("error:", error);
}
run();
