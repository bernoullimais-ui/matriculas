import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

async function run() {
  console.log("=== PAYMENTS WITH pagarme COLUMN NOT NULL ===");
  const { data: payments, error } = await supabase
    .from('pagamentos')
    .select('id, responsavel_id, valor, status, data_vencimento, data_pagamento, pagarme, matricula_id')
    .not('pagarme', 'is', null);

  if (error) {
    console.error("Error fetching pagamentos:", error);
    return;
  }

  console.log(`Found ${payments?.length || 0} payments with pagarme ID.`);
  if (payments && payments.length > 0) {
    console.table(payments.slice(0, 20).map(p => ({
      id: p.id,
      valor: p.valor,
      status: p.status,
      data_vencimento: p.data_vencimento,
      data_pagamento: p.data_pagamento,
      pagarme: p.pagarme,
      matricula_id: p.matricula_id
    })));
  }
}

run();
