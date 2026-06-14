import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Check enrollments by ID
  const ids = ['2f1c4b29-ea11-4915-9aef-69ea796d1c1b', '37e58db2-5657-4a94-83b6-78857ff7c2c3'];
  
  for (const id of ids) {
    const { data } = await supabase.from('matriculas').select('*').eq('id', id).maybeSingle();
    console.log(`\n=== MATRÍCULA ${id} ===`);
    console.log(JSON.stringify(data, null, 2));
  }

  // Show which WIX payments link to each enrollment
  console.log('\n=== WIX payments por matricula_id ===');
  for (const id of ids) {
    const { data } = await supabase
      .from('pagamentos_wix')
      .select('id, matricula_id, aluno_id, valor, status_transacao, produto_nome, data_pagamento_gmt_03, turma_id')
      .eq('matricula_id', id);
    console.log(`\nmatricula_id = ${id}:`);
    for (const p of data || []) {
      console.log(`  ${p.data_pagamento_gmt_03?.substring(0,10)} | R$${p.valor} | ${p.produto_nome} | ${p.status_transacao}`);
    }
  }
}

main().catch(console.error);
