import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: alunoData, error: alunoError } = await supabase.from('alunos').select('*').ilike('nome_completo', '%Pérola%');
  console.log("Alunos:", alunoData);
  
  if (alunoData && alunoData.length > 0) {
    const { data: matriculasData, error: matriculasError } = await supabase.from('matriculas').select('*').eq('aluno_id', alunoData[0].id);
    console.log("Matriculas:", matriculasData);
  }
}
run();
