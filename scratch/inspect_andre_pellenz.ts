import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data: payments } = await supabase
    .from('pagamentos_wix')
    .select('*')
    .or('cobranca_nome.ilike.%Pellenz%,cobranca_email.ilike.%pellenz%')
    .order('data_pagamento_gmt_03', { ascending: true });

  console.log('Payments for Pellenz family:');
  payments?.forEach(p => {
    console.log({
      id: p.id,
      cobranca_nome: p.cobranca_nome,
      cobranca_email: p.cobranca_email,
      data_pagamento: p.data_pagamento_gmt_03,
      valor: p.valor,
      status: p.status_transacao,
      provedor: p.provedor_pagamento,
      produto: p.produto_nome,
      aluno_id: p.aluno_id
    });
  });
}
run();
