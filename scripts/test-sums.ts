import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const targetOffset = -3;
const nowBrt = new Date();
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
    fetchAllFromSupabase('pagamentos', 'valor, status, data_vencimento, created_at'),
    fetchAllFromSupabase('pagamentos_wix', 'valor, status_transacao, provedor_pagamento, data_pagamento_gmt_03, created_at, aluno_id, cobranca_email, produto_nome'),
    fetchAllFromSupabase('pagamentos_pagseguro', 'valor_bruto, status, data_transacao, created_at'),
    fetchAllFromSupabase('evento_inscricoes', 'valor_pago, status, taxa_paga, provedor_pagamento, created_at'),
    fetchAllFromSupabase('loja_pedidos', 'total, status, provedor_pagamento, created_at')
  ]);

  let sumLegacy = 0, sumWix = 0, sumPagSeguro = 0, sumEventos = 0, sumLoja = 0;

  pagamentos.forEach((p: any) => {
    if (p.status === 'pago' || p.status === 'conciliado') {
      const d = processDate(p.data_vencimento, p.created_at);
      if (d >= limitStart && d <= limitEnd) sumLegacy += Number(p.valor || 0);
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
      if (d >= limitStart && d <= limitEnd) sumWix += Number(p.valor || 0);
    }
  });

  pagamentosPagSeguro.forEach((p: any) => {
    const st = (p.status || '').toLowerCase();
    if (st.includes('aprovad') || st.includes('paga') || st.includes('disponivel') || st.includes('conciliado')) {
      const d = processDate(p.data_transacao, p.created_at);
      if (d >= limitStart && d <= limitEnd) sumPagSeguro += Number(p.valor_bruto || 0);
    }
  });

  eventos.forEach((i: any) => {
    if (i.taxa_paga || (i.status || '').toLowerCase() === 'confirmada' || i.status === 'pago') {
      const d = new Date(i.created_at);
      if (d >= limitStart && d <= limitEnd) sumEventos += Number(i.valor_pago || 0);
    }
  });

  loja.forEach((p: any) => {
    if (p.status === 'pago') {
      const d = new Date(p.created_at);
      if (d >= limitStart && d <= limitEnd) sumLoja += Number(p.total || 0);
    }
  });

  console.log('Dashboard Logic Results:');
  console.log({ sumLegacy, sumWix, sumPagSeguro, sumEventos, sumLoja });
  console.log('Total Dashboard:', sumLegacy + sumWix + sumPagSeguro + sumEventos + sumLoja);
}

run().catch(console.error);
