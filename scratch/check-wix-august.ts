import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

async function check() {
  const { data: wix } = await supabase.from('pagamentos_wix').select('*');
  if (!wix) return;

  const augustPaid = wix.filter(w => {
    const d = String(w.data_pagamento_gmt_03);
    return d.includes('2026-08') || d.includes('/08/2026');
  });

  console.log(`Total Wix payments in August 2026 by data_pagamento_gmt_03: ${augustPaid.length}`);
  
  // Calculate total sum of valor
  const totalSum = augustPaid.reduce((acc, curr) => acc + Number(curr.valor || 0), 0);
  console.log(`Total sum in August 2026: R$ ${totalSum.toFixed(2)}`);

  augustPaid.slice(0, 5).forEach((w, idx) => {
    console.log(`Row ${idx + 1}:`);
    console.log(`  id: ${w.id}`);
    console.log(`  created_at: ${w.created_at}`);
    console.log(`  data_pagamento_gmt_03: ${w.data_pagamento_gmt_03}`);
    console.log(`  status_transacao: ${w.status_transacao}`);
    console.log(`  valor: ${w.valor}`);
  });
}

check();
