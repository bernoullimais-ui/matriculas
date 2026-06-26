import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const targetOffset = -3;
const limitStart = new Date(2026, 5, 1, 0, 0, 0, 0);
limitStart.setHours(limitStart.getHours() - targetOffset);
const limitEnd = new Date(2026, 6, 0, 23, 59, 59, 999);
limitEnd.setHours(limitEnd.getHours() - targetOffset);

const processDate = (dateStr: string, created: string) => {
  let d = dateStr || created;
  if (typeof d === 'string' && d.includes('/')) {
    const parts = d.split(' ')[0].split('/');
    if (parts.length === 3) {
      let y = parts[2]; if (y.length === 2) y = `20${y}`;
      d = `${y}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}T12:00:00Z`;
    }
  }
  return new Date(d);
};

const fetchAllFromSupabase = async (table: string, selectFields = '*') => {
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (!count) {
    const { data } = await supabase.from(table).select(selectFields);
    return data || [];
  }
  const pageSize = 1000;
  const totalPages = Math.ceil(count / pageSize);
  const promises = [];
  for (let i = 0; i < totalPages; i++) {
    promises.push(supabase.from(table).select(selectFields).range(i * pageSize, (i + 1) * pageSize - 1));
  }
  const results = await Promise.all(promises);
  let allData: any[] = [];
  for (const res of results) {
    if (res.data) allData = allData.concat(res.data);
  }
  return allData;
};

async function run() {
  const [pagamentos, pagamentosWix, pagamentosPagSeguro, eventos, loja] = await Promise.all([
    fetchAllFromSupabase('pagamentos', '*'),
    fetchAllFromSupabase('pagamentos_wix', '*'),
    fetchAllFromSupabase('pagamentos_pagseguro', '*'),
    fetchAllFromSupabase('evento_inscricoes', '*'),
    fetchAllFromSupabase('loja_pedidos', '*')
  ]);

  // Dash Items
  const dashItems = new Map();
  let dashTotal = 0;

  pagamentos.forEach((p: any) => {
    if (p.status === 'pago' || p.status === 'conciliado') {
      const d = processDate(p.data_vencimento, p.created_at);
      if (d >= limitStart && d <= limitEnd) {
          const val = Number(p.valor || 0);
          dashTotal += val;
          dashItems.set(`legacy_${p.id}`, val);
      }
    }
  });

  const uniqueWixMap = new Map();
  pagamentosWix.forEach((w: any) => {
    let dateStr = w.data_pagamento_gmt_03 || w.created_at;
    const sig = `${w.aluno_id || w.cobranca_email}-${dateStr}-${w.valor}-${w.produto_nome || ''}`;
    const existing = uniqueWixMap.get(sig);
    if (!existing) {
      uniqueWixMap.set(sig, w);
    } else {
      const wStatus = (w.status_transacao || '').toLowerCase();
      const eStatus = (existing.status_transacao || '').toLowerCase();
      const wSuccess = wStatus.includes('bem-sucedido') || wStatus === 'pago';
      const eSuccess = eStatus.includes('bem-sucedido') || eStatus === 'pago';
      if (wSuccess && !eSuccess) uniqueWixMap.set(sig, w);
    }
  });

  Array.from(uniqueWixMap.values()).forEach((p: any) => {
    const st = (p.status_transacao || '').toLowerCase();
    if (st.includes('bem-sucedido') || st === 'pago') {
      const d = processDate(p.data_pagamento_gmt_03, p.created_at);
      if (d >= limitStart && d <= limitEnd) {
          const val = Number(p.valor || 0);
          dashTotal += val;
          dashItems.set(`wix_${p.id}`, val);
      }
    }
  });

  pagamentosPagSeguro.forEach((p: any) => {
    const st = (p.status || '').toLowerCase();
    if (st.includes('aprovad') || st.includes('paga') || st.includes('disponivel') || st.includes('conciliado')) {
      const d = processDate(p.data_transacao, p.created_at);
      if (d >= limitStart && d <= limitEnd) {
          const val = Number(p.valor_bruto || 0);
          dashTotal += val;
          dashItems.set(`pagseguro_${p.id}`, val);
      }
    }
  });

  // FinanceTab Items
  const finItems = new Map();
  let finTotal = 0;

  // Simulate API mapping
  const mappedWix = Array.from(uniqueWixMap.values()).map((w: any) => {
    let dataVenc = (w.data_pagamento_gmt_03 && w.data_pagamento_gmt_03.trim()) || w.created_at;
    if (typeof dataVenc === 'string' && dataVenc.includes('/')) {
      const datePart = dataVenc.split(' ')[0];
      const parts = datePart.split('/');
      if (parts.length === 3) {
        let year = parts[2]; if (year.length === 2) year = `20${year}`;
        dataVenc = `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}T12:00:00Z`;
      }
    }
    return {
      ...w,
      metodo_pagamento: 'wix',
      id: `wix_${w.id}`,
      data_vencimento: dataVenc || w.created_at,
      valor: w.valor,
      status: w.status_transacao?.toLowerCase().includes('bem-sucedido') ? 'pago' : w.status_transacao
    };
  });

  const mappedPagSeguro = pagamentosPagSeguro.map((p: any) => {
    let normalizedStatus = p.status;
    const statusLower = (p.status || '').toLowerCase();
    if (statusLower.includes('aprovad') || statusLower.includes('paga') || statusLower.includes('disponivel') || statusLower.includes('conciliado')) {
      normalizedStatus = 'pago';
    }
    return {
      ...p,
      metodo_pagamento: 'cartao_credito',
      id: `pagseguro_${p.id}`,
      data_vencimento: processDate(p.data_transacao, p.created_at).toISOString(),
      valor: p.valor_bruto,
      status: normalizedStatus
    };
  });

  const legacyPagamentos = pagamentos.map((p: any) => ({ ...p, id: `legacy_${p.id}` }));

  const allPagamentos = [...legacyPagamentos, ...mappedWix, ...mappedPagSeguro];

  allPagamentos.forEach((p: any) => {
    let dStr = p.data_vencimento || p.created_at;
    if (typeof dStr === 'string' && dStr.includes('/')) {
      const parts = dStr.split(' ')[0].split('/');
      if (parts.length === 3) {
        let y = parts[2]; if (y.length === 2) y = `20${y}`;
        dStr = `${y}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}T12:00:00Z`;
      }
    }
    const payDate = new Date(dStr);
    if (isNaN(payDate.getTime()) || payDate < limitStart || payDate > limitEnd) return;

    if (p.status === 'pago' || p.status === 'conciliado') {
      const val = Number(p.valor || 0);
      finTotal += val;
      finItems.set(p.id, val);
    }
  });

  console.log(`DashTotal (Pagamentos): ${dashTotal}`);
  console.log(`FinTotal (Pagamentos): ${finTotal}`);

  // Find differences
  for (const [id, val] of dashItems.entries()) {
    if (!finItems.has(id)) {
      console.log(`IN DASH ONLY: ${id} - ${val}`);
    } else if (finItems.get(id) !== val) {
      console.log(`DIFF VALUE: ${id} Dash(${val}) != Fin(${finItems.get(id)})`);
    }
  }

  for (const [id, val] of finItems.entries()) {
    if (!dashItems.has(id)) {
      console.log(`IN FIN ONLY: ${id} - ${val}`);
    }
  }
}

run().catch(console.error);
