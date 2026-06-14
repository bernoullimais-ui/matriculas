import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

async function run() {
  const respId = "085a35fa-f0b6-4a2d-8887-0bbe113bbdaf";
  
  const { data: resp } = await supabase.from('responsaveis').select('*').eq('id', respId);
  console.log("=== RESPONSIBLE ===");
  console.log(resp);

  const { data: students } = await supabase.from('alunos').select('*').eq('responsavel_id', respId);
  console.log("=== STUDENTS ===");
  console.log(students);

  const { data: allWix } = await supabase.from('pagamentos_wix').select('*').eq('responsavel_id', respId);
  console.log("=== ALL WIX PAYMENTS FOR RESPONSIBLE ===");
  console.log(allWix?.map(w => ({
    id: w.id,
    id_pedido: w.id_pedido,
    aluno_id: w.aluno_id,
    status_transacao: w.status_transacao,
    data_pagamento_gmt_03: w.data_pagamento_gmt_03,
    produto_nome: w.produto_nome,
    valor: w.valor
  })));
}
run();
