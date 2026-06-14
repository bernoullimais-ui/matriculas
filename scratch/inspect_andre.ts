import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data: students } = await supabase
    .from('alunos')
    .select('id, nome_completo')
    .ilike('nome_completo', '%Andre%Vasconcelos%');

  console.log('Students:', students);
  if (!students || students.length === 0) return;

  const studentId = students[0].id;

  const { data: payments } = await supabase
    .from('pagamentos_wix')
    .select('*')
    .eq('aluno_id', studentId)
    .order('data_pagamento_gmt_03', { ascending: true });

  console.log('--- Payments for Andre ---');
  payments?.forEach(p => {
    console.log({
      id: p.id,
      data_pagamento: p.data_pagamento_gmt_03,
      id_provedor_pagamento: p.id_provedor_pagamento,
      valor: p.valor,
      status: p.status_transacao,
      provedor: p.provedor_pagamento,
      produto: p.produto_nome
    });
  });
}
run();
