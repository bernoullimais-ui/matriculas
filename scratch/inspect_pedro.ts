import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data: students } = await supabase
    .from('alunos')
    .select('id, nome_completo')
    .ilike('nome_completo', '%Pedro%Ferreira%');

  console.log('Students found:', students);

  const { data: payments } = await supabase
    .from('pagamentos_wix')
    .select('*')
    .ilike('cobranca_email', 'lamylyaf@hotmail.com')
    .order('data_pagamento_gmt_03', { ascending: true });

  console.log('--- Payments for lamylyaf@hotmail.com ---');
  payments?.forEach(p => {
    console.log({
      id: p.id,
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
