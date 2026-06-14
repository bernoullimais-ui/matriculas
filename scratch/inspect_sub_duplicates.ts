import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  console.log('--- Finding all payments where pagarme starts with sub_ ---');
  const { data: subPayments, error } = await supabase
    .from('pagamentos')
    .select('id, aluno_id, valor, status, pagarme, data_vencimento, data_pagamento, created_at, metodo_pagamento')
    .like('pagarme', 'sub_%');
    
  if (error) {
    console.error(error);
    return;
  }
  
  console.log(`Found ${subPayments?.length} payments starting with sub_`);
  
  // Group by pagarme value
  const grouped: { [key: string]: any[] } = {};
  for (const p of subPayments || []) {
    if (!grouped[p.pagarme]) grouped[p.pagarme] = [];
    grouped[p.pagarme].push(p);
  }
  
  console.log('\n--- Duplicate sub_ entries ---');
  for (const [subId, list] of Object.entries(grouped)) {
    if (list.length > 1) {
      console.log(`\nSubscription ID: ${subId} (has ${list.length} records)`);
      for (const item of list) {
        console.log(`  -> ID: ${item.id} | Val: ${item.valor} | Venc: ${item.data_vencimento} | Pag: ${item.data_pagamento} | Created: ${item.created_at} | Metodo: ${item.metodo_pagamento}`);
      }
    }
  }
}

run();
