import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data: alunos, error: aErr } = await supabase
    .from('alunos')
    .select('*')
    .ilike('nome_completo', `%Daniel Neder%`);
    
  if (aErr) {
    console.error('Error fetching students:', aErr);
    return;
  }
  
  console.log('Students found:', alunos);
  if (!alunos || alunos.length === 0) {
    console.log('No students found.');
    return;
  }
  
  const alunoIds = alunos.map(a => a.id);
  const { data: pagamentos, error: pErr } = await supabase
    .from('pagamentos')
    .select('*')
    .in('aluno_id', alunoIds)
    .order('data_pagamento', { ascending: false });
    
  if (pErr) {
    console.error('Error fetching payments:', pErr);
    return;
  }
  
  console.log(`Found ${pagamentos?.length} payments:`);
  for (const p of pagamentos) {
    console.log(`ID: ${p.id} | Val: ${p.valor} | Pag Date: ${p.data_pagamento} | Venc Date: ${p.data_vencimento} | Pagarme: ${p.pagarme} | Status: ${p.status} | Created: ${p.created_at}`);
  }
}

run();
