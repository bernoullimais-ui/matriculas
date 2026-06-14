import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data, error } = await supabase
    .from('pagamentos')
    .select('*');

  if (error) {
    console.error(error);
    return;
  }

  const terms = ['daniel', 'neder', 'barbosa', 'halgacyr'];
  const matches = data.filter(p => {
    const text = JSON.stringify(p).toLowerCase();
    return terms.some(t => text.includes(t));
  });

  console.log(`Found ${matches.length} matching payment records:`);
  for (const p of matches) {
    console.log(`ID: ${p.id} | Aluno: ${p.aluno_id} | Resp: ${p.responsavel_id} | Val: ${p.valor} | Pag: ${p.data_pagamento} | Venc: ${p.data_vencimento} | Pagarme: ${p.pagarme} | Status: ${p.status}`);
  }
}

run();
