import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const responsavelId = '877d13e1-5fd0-4181-8401-17449ad87f2a';
  const alunoId = '611e49cd-f5ff-42c2-ad60-1dcc87221162';

  const { data: byResponsavel, error: errResp } = await supabase
    .from('pagamentos')
    .select('*')
    .eq('responsavel_id', responsavelId);

  const { data: byAluno, error: errAluno } = await supabase
    .from('pagamentos')
    .select('*')
    .eq('aluno_id', alunoId);

  console.log('Payments by responsavel_id:', byResponsavel?.length);
  for (const p of byResponsavel || []) {
    console.log(`ID: ${p.id} | Aluno: ${p.aluno_id} | Val: ${p.valor} | Pag: ${p.data_pagamento} | Venc: ${p.data_vencimento} | Pagarme: ${p.pagarme} | Status: ${p.status}`);
  }

  console.log('\nPayments by aluno_id:', byAluno?.length);
  for (const p of byAluno || []) {
    console.log(`ID: ${p.id} | Aluno: ${p.aluno_id} | Val: ${p.valor} | Pag: ${p.data_pagamento} | Venc: ${p.data_vencimento} | Pagarme: ${p.pagarme} | Status: ${p.status}`);
  }
}

run();
