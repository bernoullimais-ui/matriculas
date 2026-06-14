import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function dump() {
  console.log("=== DUMPING ALL JUNE 4-5 PAYMENTS ===");
  
  const [pRes, wRes, rRes, aRes, mRes] = await Promise.all([
    supabase.from('pagamentos').select('*').limit(10000),
    supabase.from('pagamentos_wix').select('*').limit(10000),
    supabase.from('responsaveis').select('id, nome_completo'),
    supabase.from('alunos').select('id, nome_completo, responsavel_id'),
    supabase.from('matriculas').select('id, aluno_id, status, data_cancelamento')
  ]);

  const pagamentos = pRes.data || [];
  const pagamentosWix = wRes.data || [];
  const responsaveis = rRes.data || [];
  const alunos = aRes.data || [];
  const matriculas = mRes.data || [];

  console.log(`Fetched ${pagamentos.length} standard payments, ${pagamentosWix.length} Wix payments`);

  const start = new Date("2026-06-04T00:00:00");
  const end = new Date("2026-06-05T23:59:59");

  // 1. Filter standard pagamentos
  const juneP = pagamentos.filter(p => {
    const dStr = p.data_vencimento || p.created_at;
    if (!dStr) return false;
    const d = new Date(dStr);
    return d >= start && d <= end;
  });

  console.log(`\nFound ${juneP.length} standard pagamentos in June 4 & 5:`);
  juneP.forEach(p => {
    const resp = responsaveis.find(r => r.id === p.responsavel_id);
    const pAlunos = alunos.filter(a => a.responsavel_id === p.responsavel_id);
    console.log(`- ID: ${p.id}, Value: ${p.valor}, Status: ${p.status}, Method: ${p.metodo_pagamento}, Resp: ${resp?.nome_completo}, Alunos: ${pAlunos.map(a => a.nome_completo).join(', ')}`);
  });

  // 2. Filter pagamentos_wix
  const juneW = pagamentosWix.filter(w => {
    const dStr = w.data_pagamento_gmt_03 || w.created_at;
    if (!dStr) return false;
    const d = new Date(dStr);
    return d >= start && d <= end;
  });

  console.log(`\nFound ${juneW.length} Wix pagamentos in June 4 & 5:`);
  juneW.forEach(w => {
    const resp = responsaveis.find(r => r.id === w.responsavel_id);
    let name = 'N/A';
    if (w.aluno_id) {
      name = alunos.find(a => a.id === w.aluno_id)?.nome_completo || 'N/A';
    } else if (w.responsavel_id) {
      name = alunos.filter(a => a.responsavel_id === w.responsavel_id).map(a => a.nome_completo).join(', ');
    }
    console.log(`- ID: ${w.id}, Value: ${w.valor}, Status: ${w.status_transacao}, Resp: ${resp?.nome_completo}, Student: ${name}`);
  });
}

dump();
