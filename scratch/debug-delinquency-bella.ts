import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const BELLA_ALUNO_ID = 'e2b1dcf1-01d8-42cd-bff2-a28143d5343a';
  const MAT_NATACAO = '2f1c4b29-ea11-4915-9aef-69ea796d1c1b';
  const MAT_GR = '37e58db2-5657-4a94-83b6-78857ff7c2c3';

  const today = new Date();
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(today.getDate() - 5);
  const fiveDaysAgoStr = fiveDaysAgo.toISOString().split('T')[0];
  console.log(`Today: ${today.toISOString().split('T')[0]}, fiveDaysAgo: ${fiveDaysAgoStr}`);

  // Fetch WIX payments as the delinquencies endpoint does
  const { data: wixData, error: wErr } = await supabase
    .from('pagamentos_wix')
    .select('id, responsavel_id, matricula_id, aluno_id, valor, status_transacao, data_pagamento_gmt_03, created_at')
    .limit(10000);
  
  if (wErr) console.error('WIX fetch error:', wErr.message);
  console.log(`Total WIX payments fetched: ${wixData?.length}`);
  
  // Fetch Pagar.me payments
  const { data: pmData, error: pmErr } = await supabase
    .from('pagamentos_pagarme')
    .select('id, responsavel_id, matricula_id, aluno_id, valor_liquido, valor_bruto, status, data_criacao, created_at')
    .limit(10000);
  
  if (pmErr) console.error('Pagar.me fetch error (non-fatal):', pmErr.message);
  console.log(`Total Pagar.me payments fetched: ${pmData?.length ?? 'ERROR'}`);

  // Fetch regular payments
  const { data: pagData } = await supabase.from('pagamentos').select('*').limit(10000);
  console.log(`Total pagamentos: ${pagData?.length}`);

  // Normalize WIX
  const pagamentosWixNorm = (wixData || []).map(w => ({
    id: `wix_${w.id}`,
    responsavel_id: w.responsavel_id,
    matricula_id: w.matricula_id,
    aluno_id: w.aluno_id,
    valor: w.valor,
    data_vencimento: w.data_pagamento_gmt_03 || w.created_at,
    created_at: w.created_at,
    status: (w.status_transacao || '').toLowerCase().includes('bem-sucedido') || (w.status_transacao || '').toLowerCase() === 'pago' ? 'pago' :
            ((w.status_transacao || '').toLowerCase().includes('recusado') || (w.status_transacao || '').toLowerCase().includes('falhou') || (w.status_transacao || '').toLowerCase().includes('falha') || (w.status_transacao || '').toLowerCase().includes('failed')) ? 'falha' : 'pendente',
    source: 'wix'
  }));

  // Merge all
  const pagamentosList = [
    ...(pagData || []),
    ...pagamentosWixNorm,
    // Pagar.me excluded if error
  ];

  console.log(`\nTotal merged payments: ${pagamentosList.length}`);

  // Check payments for each enrollment
  for (const matId of [MAT_NATACAO, MAT_GR]) {
    const matName = matId === MAT_NATACAO ? 'Natação Vespertino Infantil 2' : 'GR Vespertino';
    const payments = pagamentosList.filter(p =>
      String(p.matricula_id) === String(matId) ||
      (!p.matricula_id && String(p.aluno_id) === String(BELLA_ALUNO_ID))
    );
    const paidPayments = payments.filter(p => p.status === 'pago');

    console.log(`\n=== ${matName} (${matId.substring(0,8)}) ===`);
    console.log(`Total payments matched: ${payments.length}`);
    console.log(`Paid payments: ${paidPayments.length}`);
    for (const p of paidPayments) {
      console.log(`  ${(p as any).source || 'pagamentos'} | matricula_id=${p.matricula_id?.substring(0,8)} | R$${p.valor} | ${p.data_vencimento?.substring(0,10)} | status=${p.status}`);
    }

    // Expected installments calculation
    const { data: mat } = await supabase.from('matriculas').select('*').eq('id', matId).maybeSingle();
    const dataMatriculaStr = mat?.data_matricula || mat?.created_at;
    const start = new Date(dataMatriculaStr);
    const calcEnd = new Date(today);
    
    let expectedCount = 0;
    let baseDay = start.getDate();
    if (baseDay === 31) baseDay = 30;
    
    const firstDueDate = start.toISOString().split('T')[0];
    if (firstDueDate <= fiveDaysAgoStr) expectedCount++;

    let next = new Date(start);
    next.setDate(1);
    next.setMonth(next.getMonth() + 1);
    next.setDate(baseDay);
    while (next <= calcEnd) {
      const d = next.toISOString().split('T')[0];
      if (d <= fiveDaysAgoStr) expectedCount++;
      next = new Date(next);
      next.setDate(1);
      next.setMonth(next.getMonth() + 1);
      next.setDate(baseDay);
    }
    console.log(`Expected count: ${expectedCount}, Paid: ${paidPayments.length} → ${paidPayments.length < expectedCount ? '⚠️ DELINQUENT' : '✅ OK'}`);
  }
}

main().catch(console.error);
