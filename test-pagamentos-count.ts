import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data: pagamentos, error } = await supabase.from('pagamentos')
    .select('valor, status, data_pagamento, data_vencimento, created_at')
    .in('status', ['pago', 'conciliado']);

  let count = 0;
  pagamentos?.forEach(p => {
    if (p.data_vencimento?.startsWith('2026-06')) {
      count++;
    }
  });
  console.log("Count in June by data_vencimento:", count);

  let count2 = 0;
  pagamentos?.forEach(p => {
    if (p.data_pagamento?.startsWith('2026-06')) {
      count2++;
    }
  });
  console.log("Count in June by data_pagamento:", count2);
  console.log("Total pagamentos fetched:", pagamentos?.length);
}

run();
