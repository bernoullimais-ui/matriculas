import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  console.log("=== INSPECTING WIX PLAN NAMES VS ENROLLMENTS ===");
  
  const { data: wixPags } = await supabase
    .from('pagamentos_wix')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000);

  const juneWix = wixPags?.filter(w => {
    const dStr = w.data_pagamento_gmt_03 || w.created_at;
    if (!dStr) return false;
    const d = new Date(dStr);
    return d >= new Date("2026-06-04T00:00:00") && d <= new Date("2026-06-05T23:59:59");
  }) || [];

  for (const w of juneWix) {
    if (!w.aluno_id) {
      console.log(`Payment ID ${w.id}: No student linked. Resp Email: ${w.cobranca_email}`);
      continue;
    }

    const { data: aluno } = await supabase.from('alunos').select('nome_completo').eq('id', w.aluno_id).single();
    const { data: mats } = await supabase.from('matriculas').select('*').eq('aluno_id', w.aluno_id);

    console.log(`\nPayment ID: ${w.id}`);
    console.log(`- Student: ${aluno?.nome_completo} (ID: ${w.aluno_id})`);
    console.log(`- Wix Plan Name (produto_nome): "${w.produto_nome}"`);
    console.log(`- Resolved matricula_id: ${w.matricula_id}`);
    console.log(`- Enrollments in DB:`);
    mats?.forEach(m => {
      console.log(`  * ID: ${m.id}, Class: "${m.turma}", Plan: "${m.plano}", Status: "${m.status}", CancelledDate: ${m.data_cancelamento}`);
    });
  }
}

inspect();
