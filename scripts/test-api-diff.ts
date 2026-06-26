import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const targetOffset = -3;
const limitStart = new Date(2026, 5, 1, 0, 0, 0, 0);
limitStart.setHours(limitStart.getHours() - targetOffset);
const limitEnd = new Date(2026, 6, 0, 23, 59, 59, 999);
limitEnd.setHours(limitEnd.getHours() - targetOffset);

async function run() {
  const { data: rawEventos } = await supabase.from('evento_inscricoes').select('*');
  const { data: apiEventos } = await supabase.from('evento_inscricoes').select('*, eventos(*)');
  
  const v1 = rawEventos?.filter(i => (i.taxa_paga || (i.status || '').toLowerCase() === 'confirmada' || i.status === 'pago') && new Date(i.created_at) >= limitStart && new Date(i.created_at) <= limitEnd) || [];
  const v2 = apiEventos?.filter(i => (i.taxa_paga || (i.status || '').toLowerCase() === 'confirmada' || i.status === 'pago') && new Date(i.created_at) >= limitStart && new Date(i.created_at) <= limitEnd) || [];
  
  const sum1 = v1.reduce((acc, i) => acc + Number(i.valor_pago||0), 0);
  const sum2 = v2.reduce((acc, i) => acc + Number(i.valor_pago||0), 0);
  
  console.log(`Raw Eventos: ${v1.length} items, sum: ${sum1}`);
  console.log(`API Eventos: ${v2.length} items, sum: ${sum2}`);

  const { data: rawLoja } = await supabase.from('loja_pedidos').select('*');
  const { data: apiLoja } = await supabase.from('loja_pedidos').select('*, loja_produtos(*)');
  
  const l1 = rawLoja?.filter(p => p.status === 'pago' && new Date(p.created_at) >= limitStart && new Date(p.created_at) <= limitEnd) || [];
  const l2 = apiLoja?.filter(p => p.status === 'pago' && new Date(p.created_at) >= limitStart && new Date(p.created_at) <= limitEnd) || [];

  const s1 = l1.reduce((acc, p) => acc + Number(p.total||0), 0);
  const s2 = l2.reduce((acc, p) => acc + Number(p.total||0), 0);

  console.log(`Raw Loja: ${l1.length} items, sum: ${s1}`);
  console.log(`API Loja: ${l2.length} items, sum: ${s2}`);
}

run().catch(console.error);
