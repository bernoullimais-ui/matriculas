import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const targetOffset = -3;
const limitStart = new Date(2026, 5, 1, 0, 0, 0, 0);
limitStart.setHours(limitStart.getHours() - targetOffset);
const limitEnd = new Date(2026, 6, 0, 23, 59, 59, 999);
limitEnd.setHours(limitEnd.getHours() - targetOffset);

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
  const loja = await fetchAllFromSupabase('loja_pedidos', '*');
  const eventos = await fetchAllFromSupabase('evento_inscricoes', '*');
  
  const validLoja = loja.filter(p => {
      const d = new Date(p.created_at);
      return d >= limitStart && d <= limitEnd && p.status === 'pago';
  });
  console.log(`Loja inside June (PAGO): ${validLoja.length}. Sum: `, validLoja.reduce((acc, p) => acc + Number(p.total||0), 0));

  const validEventos = eventos.filter(i => {
      const d = new Date(i.created_at);
      return d >= limitStart && d <= limitEnd && (i.taxa_paga || (i.status || '').toLowerCase() === 'confirmada' || i.status === 'pago');
  });
  console.log(`Eventos inside June (PAGO): ${validEventos.length}. Sum: `, validEventos.reduce((acc, p) => acc + Number(p.valor_pago||0), 0));
}

run().catch(console.error);
