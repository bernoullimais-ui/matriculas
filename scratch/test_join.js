import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const [
    { data: responsaveis },
    { data: alunos },
    { data: matriculas }
  ] = await Promise.all([
    supabase.from('responsaveis').select('id, nome_completo, email, telefone, cpf').order('created_at', { ascending: false }).limit(10000),
    supabase.from('alunos').select('id, nome_completo, serie_ano, responsavel_id, data_nascimento').order('created_at', { ascending: false }).limit(10000),
    supabase.from('matriculas').select('id, aluno_id, turma, unidade, status, data_cancelamento, data_matricula, plano').order('created_at', { ascending: false }).limit(10000)
  ]);

  const r = responsaveis.find(x => x.nome_completo.includes("Lilian Sampaio"));
  if (!r) {
    console.log("Lilian Sampaio not found in responsaveis!");
    return;
  }
  
  console.log("Found responsavel:", r);
  
  const a = alunos.filter(x => String(x.responsavel_id).trim() === String(r.id).trim());
  console.log("Found alunos:", a);
  
  if (a.length > 0) {
    const m = matriculas.filter(x => String(x.aluno_id).trim() === String(a[0].id).trim());
    console.log("Found matriculas:", m);
  }
}
run();
