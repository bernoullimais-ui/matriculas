import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("=== SIMULATING CLIENT FILTERING ===");
  
  // 1. Fetch data just like server.ts `/api/admin/financial-report`
  const [pRes, wRes, psRes, rRes, aRes, mRes, tRes] = await Promise.all([
    supabase.from('pagamentos').select('*').order('created_at', { ascending: false }).limit(10000),
    supabase.from('pagamentos_wix').select('*').order('created_at', { ascending: false }).limit(10000),
    supabase.from('pagamentos_pagseguro').select('*').order('created_at', { ascending: false }).limit(10000),
    supabase.from('responsaveis').select('id, nome_completo, email').order('created_at', { ascending: false }).limit(10000),
    supabase.from('alunos').select('id, nome_completo, responsavel_id, turma_escolar').order('created_at', { ascending: false }).limit(10000),
    supabase.from('matriculas').select('*').order('created_at', { ascending: false }).limit(10000),
    supabase.from('turmas').select('id, nome, professor, unidade_nome').limit(10000)
  ]);

  const pagamentos = pRes.data || [];
  const pagamentosWix = wRes.data || [];
  const pagamentosPagSeguro = psRes.data || [];
  const responsaveis = rRes.data || [];
  const alunos = aRes.data || [];
  const rawMatriculas = mRes.data || [];
  const turmas = tRes.data || [];

  const matriculas = rawMatriculas.map(m => {
    if (!m.unidade || !m.turma) {
      const t = turmas.find(tr => String(tr.id) === String(m.turma_id));
      if (t) {
        return {
          ...m,
          unidade: m.unidade || t.unidade_nome,
          turma: m.turma || t.nome
        };
      }
    }
    return m;
  });

  const mappedWix = pagamentosWix.map(w => {
    let dataVenc = (w.data_pagamento_gmt_03 && w.data_pagamento_gmt_03.trim()) || w.created_at;
    
    if (typeof dataVenc === 'string' && dataVenc.includes('/')) {
      const datePart = dataVenc.split(' ')[0];
      const parts = datePart.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        let year = parts[2];
        if (year.length === 2) year = `20${year}`;
        dataVenc = `${year}-${month}-${day}T12:00:00Z`;
      }
    }

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

  const mappedPagSeguro = pagamentosPagSeguro.map(ps => {
    let dataVenc = ps.data_transacao || ps.created_at;
    if (typeof dataVenc === 'string' && dataVenc.includes('/')) {
      const datePart = dataVenc.split(' ')[0];
      const parts = datePart.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        let year = parts[2];
        if (year.length === 2) year = `20${year}`;
        dataVenc = `${year}-${month}-${day}T12:00:00Z`;
      }
    }
    const statusLower = (ps.status || '').toLowerCase();
    let normalizedStatus = 'pendente';
    if (statusLower.includes('aprovad') || statusLower.includes('paga') || statusLower.includes('disponivel') || statusLower.includes('conciliado')) {
      normalizedStatus = 'pago';
    } else if (statusLower.includes('cancelad') || statusLower.includes('devolvida') || statusLower.includes('estornado')) {
      normalizedStatus = 'cancelado';
    } else if (statusLower.includes('falhou') || statusLower.includes('recusado')) {
      normalizedStatus = 'falha';
    }

    return {
      ...ps,
      id: ps.id,
      responsavel_id: ps.responsavel_id,
      matricula_id: ps.matricula_id,
      aluno_id: ps.aluno_id,
      valor: ps.valor_bruto,
      status: normalizedStatus,
      metodo_pagamento: 'pagseguro',
      data_vencimento: dataVenc || ps.created_at,
      created_at: ps.created_at,
      is_pagseguro: true
    };
  });

  const allPagamentos = [...pagamentos, ...mappedWix, ...mappedPagSeguro];

  const detailedPagamentos = allPagamentos.map(p => {
    const resp = responsaveis.find(r => String(r.id) === String(p.responsavel_id));
    let respAlunos = [];

    if (p.matricula_id) {
      const mat = matriculas.find(m => String(m.id).trim() === String(p.matricula_id).trim());
      if (mat) {
        const aluno = alunos.find(a => String(a.id).trim() === String(mat.aluno_id).trim());
        if (aluno) {
          respAlunos = [{
            ...aluno,
            matriculas: [mat]
          }];
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

    return {
      ...p,
      responsaveis: resp ? {
        ...resp,
        alunos: respAlunos
      } : null
    };
  });

  // Now apply App.tsx frontend filters for custom period June 4 & 5, paymentMethod 'geral', status 'pago'
  const financeFilters = {
    paymentMethod: 'geral',
    wixType: '',
    unidade: '',
    professor: '',
    status: 'pago',
    period: 'custom',
    startDate: '2026-06-04',
    endDate: '2026-06-05',
    search: ''
  };

  const filtered = detailedPagamentos.filter(p => {
    // Payment Method Filter
    if (financeFilters.paymentMethod !== 'geral') {
      if (financeFilters.paymentMethod === 'pix') {
        if (p.metodo_pagamento !== 'pix') return false;
      } else if (financeFilters.paymentMethod === 'pagarme') {
        if (p.metodo_pagamento !== 'cartao_credito' && !p.pagarme) return false;
      } else if (financeFilters.paymentMethod === 'pagseguro') {
        if (p.metodo_pagamento !== 'pagseguro') return false;
      } else if (financeFilters.paymentMethod === 'wix') {
        if (p.metodo_pagamento !== 'wix') return false;
      }
    }

    // Status filter
    if (financeFilters.status) {
      const isPaid = p.status?.toLowerCase() === 'pago';
      const isCancelled = p.status?.toLowerCase() === 'cancelado';
      const isFailed = p.status?.toLowerCase() === 'falha';
      const isPending = !isPaid && !isCancelled;

      if (financeFilters.status === 'pago') {
        if (!isPaid) return false;
      } else if (financeFilters.status === 'pendente') {
        if (!isPending) return false;
        if (p.data_vencimento) {
          const dueDate = new Date(p.data_vencimento);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (dueDate >= today) return false;
        }
      } else if (financeFilters.status === 'a_vencer') {
        if (!isPending) return false;
        if (p.data_vencimento) {
          const dueDate = new Date(p.data_vencimento);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (dueDate < today) return false;
        } else {
          return false;
        }
      } else if (p.status !== financeFilters.status) {
        return false;
      }
    }

    // Period filter
    if (financeFilters.period) {
      const paymentDateStr = (p.data_vencimento && p.data_vencimento.trim()) || p.created_at;
      if (!paymentDateStr) return false;
      
      let paymentDate = new Date(paymentDateStr);
      
      // Manual parse if needed for filtering
      if (isNaN(paymentDate.getTime()) && typeof paymentDateStr === 'string') {
        if (paymentDateStr.includes('/')) {
          const parts = paymentDateStr.split(' ')[0].split('/');
          if (parts.length === 3) {
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1;
            const year = parts[2].length === 2 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);
            paymentDate = new Date(year, month, day);
          }
        } else if (paymentDateStr.includes('-')) {
          const parts = paymentDateStr.split('T')[0].split('-');
          if (parts.length === 3) {
            const year = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1;
            const day = parseInt(parts[2]);
            paymentDate = new Date(year, month, day);
          }
        }
      }

      if (isNaN(paymentDate.getTime())) return false;
      
      if (financeFilters.period === 'custom') {
        if (financeFilters.startDate) {
          const [year, month, day] = financeFilters.startDate.split('-').map(Number);
          const start = new Date(year, month - 1, day, 0, 0, 0, 0);
          if (paymentDate < start) return false;
        }
        if (financeFilters.endDate) {
          const [year, month, day] = financeFilters.endDate.split('-').map(Number);
          const end = new Date(year, month - 1, day, 23, 59, 59, 999);
          if (paymentDate > end) return false;
        }
      }
    }

    const resp = p.responsaveis;
    let matchesSearch = true;
    if (financeFilters.search) {
      const searchLower = financeFilters.search.toLowerCase();
      const respName = resp?.nome_completo?.toLowerCase() || '';
      const studentNames = resp?.alunos?.map((a: any) => a.nome_completo?.toLowerCase() || '') || [];
      matchesSearch = respName.includes(searchLower) || studentNames.some((name: string) => name.includes(searchLower));
    }
    if (!matchesSearch) return false;

    if (!financeFilters.unidade && !financeFilters.professor) return true;

    if (!resp || !Array.isArray(resp.alunos)) return false;

    return resp.alunos.some((aluno: any) => {
      if (!Array.isArray(aluno.matriculas)) return false;
      return aluno.matriculas.some((mat: any) => {
        if (mat.status && mat.status !== 'ativo') return false;
        if (mat.data_cancelamento) return false;
        const matchesUnidade = !financeFilters.unidade || 
          (mat.unidade && mat.unidade.trim().toLowerCase() === financeFilters.unidade.trim().toLowerCase());
        return matchesUnidade;
      });
    });
  });

  console.log(`\nFiltered ${filtered.length} payments in June 4 & 5:`);
  filtered.forEach(p => {
    const studentName = p.responsaveis?.alunos?.[0]?.nome_completo || 'N/A';
    console.log(`- Method: ${p.metodo_pagamento}, Value: ${p.valor}, Status: ${p.status}, Student: ${studentName}, Date: ${p.data_vencimento}`);
  });
}

test();
