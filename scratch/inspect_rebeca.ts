import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

async function run() {
  console.log("=== ALL WIX PAYMENTS FOR rebecabrasilcosta@gmail.com ===");
  const { data: wixPayments, error: errWix } = await supabase
    .from('pagamentos_wix')
    .select('id_provedor_pagamento, data_pagamento_gmt_03, produto_nome, valor, status_transacao, provedor_pagamento, id_pedido')
    .eq('cobranca_email', 'rebecabrasilcosta@gmail.com')
    .order('data_pagamento_gmt_03', { ascending: false });

  if (errWix) {
    console.error("Error fetching wix payments:", errWix);
    return;
  }

  console.log(`Found ${wixPayments.length} payments:`);
  console.table(wixPayments);
}

run();
