import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("=== SIMULATING FINANCIAL REPORT FETCH ===");
  
  const [wRes, rRes, aRes, mRes, tRes] = await Promise.all([
    supabase.from('pagamentos_wix').select('*').order('created_at', { ascending: false }).limit(10000),
    supabase.from('responsaveis').select('id, nome_completo, email').order('created_at', { ascending: false }).limit(10000),
    supabase.from('alunos').select('id, nome_completo, responsavel_id, turma_escolar').order('created_at', { ascending: false }).limit(10000),
    supabase.from('matriculas').select('*').order('created_at', { ascending: false }).limit(10000),
    supabase.from('turmas').select('id, nome, professor, unidade_nome').limit(10000)
  ]);

  const pagamentosWix = wRes.data || [];
  const responsaveis = rRes.data || [];
  const alunos = aRes.data || [];
  const matriculas = mRes.data || [];
  const turmas = tRes.data || [];

  console.log(`Fetched: ${pagamentosWix.length} Wix payments, ${responsaveis.length} guardians, ${alunos.length} students, ${matriculas.length} enrollments.`);

  // Map Wix payments
  const mappedWix = pagamentosWix.map(w => {
    let dataVenc = (w.data_pagamento_gmt_03 && w.data_pagamento_gmt_03.trim()) || w.created_at;
    return {
      ...w,
      id: w.id,
      responsavel_id: w.responsavel_id,
      matricula_id: w.matricula_id,
      aluno_id: w.aluno_id,
      valor: w.valor,
      status: (w.status_transacao || '').toLowerCase().includes('bem-sucedido') ? 'pago' : 
              ((w.status_transacao || '').toLowerCase().includes('recusado') || 
               (w.status_transacao || '').toLowerCase().includes('falhou') || 
               (w.status_transacao || '').toLowerCase().includes('falha') || 
               (w.status_transacao || '').toLowerCase().includes('failed')) ? 'falha' : 
              (w.status_transacao || '').toLowerCase() === 'pago' ? 'pago' : 'pendente',
      metodo_pagamento: 'wix',
      data_vencimento: dataVenc || w.created_at,
      created_at: w.created_at,
      tipo_pedido: w.tipo_pedido,
      is_wix: true
    };
  });

  // Filter mapped wix payments to June 4 & 5
  const juneWix = mappedWix.filter(p => {
    const paymentDateStr = p.data_vencimento || p.created_at;
    if (!paymentDateStr) return false;
    const paymentDate = new Date(paymentDateStr);
    
    const start = new Date("2026-06-04T00:00:00");
    const end = new Date("2026-06-05T23:59:59");
    return paymentDate >= start && paymentDate <= end;
  });

  console.log(`\nFound ${juneWix.length} Wix payments in June 4 & 5 range.`);

  juneWix.forEach((p, idx) => {
    const resp = responsaveis.find(r => String(r.id) === String(p.responsavel_id));
    let respAlunos = [];

    if (p.matricula_id) {
      const mat = matriculas.find(m => String(m.id).trim() === String(p.matricula_id).trim());
      if (mat) {
        const aluno = alunos.find(a => String(a.id).trim() === String(mat.aluno_id).trim());
        if (aluno) {
          respAlunos = [{ ...aluno, matriculas: [mat] }];
        }
      }
    } 
    
    if (respAlunos.length === 0 && p.aluno_id) {
      const aluno = alunos.find(a => String(a.id).trim() === String(p.aluno_id).trim());
      if (aluno) {
        respAlunos = [{
          ...aluno,
          matriculas: matriculas.filter(m => String(m.aluno_id).trim() === String(aluno.id).trim())
        }];
      }
    }

    if (respAlunos.length === 0 && p.responsavel_id) {
      respAlunos = alunos
        .filter(a => String(a.responsavel_id) === String(p.responsavel_id))
        .map(a => ({
          ...a,
          matriculas: matriculas.filter(m => String(m.aluno_id) === String(a.id))
        }));
    }

    console.log(`[${idx}] Date: ${p.data_vencimento}, Value: ${p.valor}, Status: ${p.status}, GuardianFound: ${!!resp}, AlunosCount: ${respAlunos.length}`);
    if (respAlunos.length > 0) {
      console.log(`    Student: ${respAlunos[0].nome_completo}, Enrollments: ${respAlunos[0].matriculas?.map((m: any) => `${m.turma} (${m.status})`).join(', ')}`);
    }
  });
}

test();
