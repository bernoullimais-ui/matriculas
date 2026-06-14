import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

async function run() {
  console.log("=== STUDENTS (ALUNOS) ===");
  const { data: alumnos, error: errAlunos } = await supabase
    .from('alunos')
    .select('*')
    .ilike('nome_completo', '%Julia%');
  if (errAlunos) console.error("Error fetching alumnos:", errAlunos);
  else console.log(JSON.stringify(alumnos, null, 2));

  console.log("=== RESPONSAVEIS ===");
  const { data: responsaveis, error: errResp } = await supabase
    .from('responsaveis')
    .select('*')
    .ilike('nome_completo', '%Tapioca%');
  if (errResp) console.error("Error fetching responsaveis:", errResp);
  else console.log(JSON.stringify(responsaveis, null, 2));

  console.log("=== ALL STUDENTS BY RESPONSIBLE ===");
  if (responsaveis && responsaveis.length > 0) {
    for (const r of responsaveis) {
      const { data: aByR } = await supabase
        .from('alunos')
        .select('*')
        .eq('responsavel_id', r.id);
      console.log(`Students for responsible ${r.nome_completo} (ID: ${r.id}):`);
      console.log(JSON.stringify(aByR, null, 2));
    }
  }

  console.log("=== ENROLLMENTS (MATRICULAS) FOR THESE STUDENTS ===");
  if (alumnos && alumnos.length > 0) {
    for (const a of alumnos) {
      const { data: mats } = await supabase
        .from('matriculas')
        .select('*')
        .eq('aluno_id', a.id);
      console.log(`Matriculas for student ${a.nome_completo} (ID: ${a.id}):`);
      console.log(JSON.stringify(mats, null, 2));
    }
  }

  console.log("=== WIX PAYMENTS ===");
  const { data: wixPayments, error: errWix } = await supabase
    .from('pagamentos_wix')
    .select('*')
    .ilike('cobranca_email', '%tapioca%');
  if (errWix) console.error("Error fetching wix payments:", errWix);
  else console.log(JSON.stringify(wixPayments, null, 2));
}

run();
