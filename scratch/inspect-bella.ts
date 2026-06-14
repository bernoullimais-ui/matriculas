import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Find Bella
  const { data: alunos } = await supabase
    .from('alunos')
    .select('*')
    .ilike('nome_completo', '%bella sento%');

  if (!alunos?.length) { console.log('Aluno não encontrado'); return; }
  
  for (const aluno of alunos) {
    console.log('\n=== ALUNO ===');
    console.log(JSON.stringify(aluno, null, 2));

    // Get enrollments
    const { data: matriculas } = await supabase
      .from('matriculas')
      .select('*')
      .eq('aluno_id', aluno.id);
    
    console.log('\n=== MATRÍCULAS ===');
    for (const m of matriculas || []) {
      console.log(JSON.stringify(m, null, 2));
    }

    // Get payments from pagamentos
    const { data: pag } = await supabase
      .from('pagamentos')
      .select('*')
      .eq('aluno_id', aluno.id);
    
    console.log('\n=== PAGAMENTOS (pagamentos) ===');
    console.log(JSON.stringify(pag, null, 2));

    // Get WIX payments
    const { data: wix } = await supabase
      .from('pagamentos_wix')
      .select('*')
      .eq('aluno_id', aluno.id);
    
    console.log('\n=== PAGAMENTOS WIX (por aluno_id) ===');
    console.log(JSON.stringify(wix, null, 2));

    // Also try by responsavel email
    const { data: responsavel } = await supabase
      .from('responsaveis')
      .select('*')
      .eq('id', aluno.responsavel_id)
      .maybeSingle();

    if (responsavel) {
      console.log('\n=== RESPONSÁVEL ===');
      console.log(JSON.stringify(responsavel, null, 2));

      const { data: wixByResp } = await supabase
        .from('pagamentos_wix')
        .select('*')
        .eq('responsavel_id', responsavel.id);
      
      console.log('\n=== PAGAMENTOS WIX (por responsavel_id) ===');
      console.log(JSON.stringify(wixByResp?.map(w => ({
        id: w.id,
        matricula_id: w.matricula_id,
        aluno_id: w.aluno_id,
        valor: w.valor,
        status_transacao: w.status_transacao,
        tipo_pedido: w.tipo_pedido,
        data_pagamento_gmt_03: w.data_pagamento_gmt_03
      })), null, 2));

      // Check pagamentos by responsavel_id
      const { data: pagByResp } = await supabase
        .from('pagamentos')
        .select('*')
        .eq('responsavel_id', responsavel.id);
      
      console.log('\n=== PAGAMENTOS (por responsavel_id) ===');
      console.log(JSON.stringify(pagByResp?.map(p => ({
        id: p.id,
        matricula_id: p.matricula_id,
        aluno_id: p.aluno_id,
        status: p.status,
        valor: p.valor,
        data_vencimento: p.data_vencimento
      })), null, 2));
    }
  }
}

main().catch(console.error);
