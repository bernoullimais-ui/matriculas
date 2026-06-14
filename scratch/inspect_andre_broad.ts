import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data: students } = await supabase
    .from('alunos')
    .select('id, nome_completo')
    .ilike('nome_completo', '%Vasconcelos%');

  console.log('Students containing Vasconcelos:', students);

  const { data: responsaveis } = await supabase
    .from('responsaveis')
    .select('id, nome_completo, email')
    .ilike('nome_completo', '%Vasconcelos%');

  console.log('Responsaveis containing Vasconcelos:', responsaveis);

  const { data: payments } = await supabase
    .from('pagamentos_wix')
    .select('*')
    .ilike('cobranca_nome', '%Vasconcelos%');

  console.log('Payments containing Vasconcelos:', payments?.map(p => ({
    id: p.id,
    cobranca_nome: p.cobranca_nome,
    data_pagamento: p.data_pagamento_gmt_03,
    status: p.status_transacao,
    produto: p.produto_nome
  })));
}
run();
