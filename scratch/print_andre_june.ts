import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data: payments } = await supabase
    .from('pagamentos_wix')
    .select('*')
    .or('cobranca_nome.ilike.%Pellenz%,cobranca_email.ilike.%pellenz%')
    .gte('data_pagamento_gmt_03', '2026-05-01T00:00:00Z')
    .order('data_pagamento_gmt_03', { ascending: true });

  console.log('Payments for Pellenz (May/June 2026):');
  payments?.forEach(p => {
    console.log({
      id: p.id,
      cobranca_nome: p.cobranca_nome,
      data_pagamento: p.data_pagamento_gmt_03,
      valor: p.valor,
      status: p.status_transacao,
      provedor: p.provedor_pagamento,
      produto: p.produto_nome,
      id_provedor_pagamento: p.id_provedor_pagamento
    });
  });
}
run();
