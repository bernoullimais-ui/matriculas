import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

async function run() {
  console.log("=== BEM-SUCEDIDO WIX API CRON PAYMENTS FOR JUNE 2026 ===");
  const { data: payments, error } = await supabase
    .from('pagamentos_wix')
    .select('id, id_provedor_pagamento, cobranca_email, cobranca_nome, produto_nome, valor, status_transacao, data_pagamento_gmt_03')
    .like('data_pagamento_gmt_03', '2026-06-%')
    .eq('provedor_pagamento', 'Wix API Cron')
    .eq('status_transacao', 'Bem-sucedido');

  if (error) {
    console.error("Error fetching payments:", error);
    return;
  }

  console.log(`Found ${payments?.length || 0} payments:`);
  console.table(payments.map(p => ({
    id_provedor_pagamento: p.id_provedor_pagamento,
    cobranca_email: p.cobranca_email,
    cobranca_nome: p.cobranca_nome,
    produto_nome: p.produto_nome,
    valor: p.valor,
    data: p.data_pagamento_gmt_03
  })));
}

run();
