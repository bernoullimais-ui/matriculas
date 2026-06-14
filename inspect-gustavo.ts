import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data, error } = await supabase
    .from('pagamentos_wix')
    .select('*')
    .eq('cobranca_email', 'heisinha1@gmail.com');

  if (error) {
    console.error('Error fetching payments:', error);
    return;
  }

  console.log('--- Gustavo Payments in DB ---');
  data.forEach((p: any) => {
    console.log({
      id: p.id,
      data_pagamento: p.data_pagamento_gmt_03,
      id_provedor_pagamento: p.id_provedor_pagamento,
      valor: p.valor,
      status: p.status_transacao,
      provedor: p.provedor_pagamento,
      created_at: p.created_at
    });
  });
}
run();
