import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

async function check() {
  const { data: wix } = await supabase.from('pagamentos_wix').select('*');
  if (!wix) return;

  const junePaid = wix.filter(w => {
    const d = String(w.data_pagamento_gmt_03);
    return d.includes('2026-06') || d.includes('/06/2026');
  });

  console.log(`Total Wix payments in June 2026 by data_pagamento_gmt_03: ${junePaid.length}`);
  
  junePaid.slice(0, 10).forEach((w, idx) => {
    console.log(`Row ${idx + 1}:`);
    console.log(`  id: ${w.id}`);
    console.log(`  created_at: ${w.created_at}`);
    console.log(`  data_pagamento_gmt_03: ${w.data_pagamento_gmt_03}`);
    console.log(`  status_transacao: ${w.status_transacao}`);
    console.log(`  valor: ${w.valor}`);
    console.log(`  cobranca_nome: ${w.cobranca_nome} ${w.cobranca_sobrenome}`);
    console.log(`  produto_nome: ${w.produto_nome}`);
  });
}

check();
