import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // The two WIX payments for GR Fundamental Bilíngue that were incorrectly
  // linked to Natação enrollment (2f1c4b29) instead of GR enrollment (37e58db2)
  const wrongIds = [
    '30345a3e-a73f-4466-a375-430e107487c1', // Apr 04 R$292 GR
    'bc14b794-08a1-45d3-bf04-dfe0f2169cba'  // May 22 R$292 GR
  ];
  
  const correctMatriculaId = '37e58db2-5657-4a94-83b6-78857ff7c2c3';
  const correctTurmaId = '9a1fa0d2-e20f-4f5b-b887-5997d6670a98'; // GR Vespertino turma_id

  console.log('Correcting WIX payment linkage for Bella Sento Sé Núñez...');
  
  for (const id of wrongIds) {
    const { data, error } = await supabase
      .from('pagamentos_wix')
      .update({
        matricula_id: correctMatriculaId,
        turma_id: correctTurmaId
      })
      .eq('id', id)
      .select('id, matricula_id, turma_id, valor, produto_nome, data_pagamento_gmt_03');

    if (error) {
      console.error(`Error updating ${id}:`, error.message);
    } else {
      console.log(`✓ Updated payment ${id}:`, JSON.stringify(data?.[0], null, 2));
    }
  }

  // Verify result
  console.log('\n=== Verifying final state ===');
  const { data: after } = await supabase
    .from('pagamentos_wix')
    .select('id, matricula_id, valor, produto_nome, data_pagamento_gmt_03')
    .eq('aluno_id', 'e2b1dcf1-01d8-42cd-bff2-a28143d5343a')
    .order('data_pagamento_gmt_03');
  
  for (const p of after || []) {
    const mat = p.matricula_id === '2f1c4b29-ea11-4915-9aef-69ea796d1c1b' ? 'Natação' :
                p.matricula_id === '37e58db2-5657-4a94-83b6-78857ff7c2c3' ? 'GR Vespertino' : 'NULL';
    console.log(`${p.data_pagamento_gmt_03?.substring(0,10)} | R$${p.valor} | ${mat} | ${p.produto_nome?.substring(0,40)}`);
  }
}

main().catch(console.error);
