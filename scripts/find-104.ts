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
  const { data: loja } = await supabase.from('loja_pedidos').select('*');
  const { data: eventos } = await supabase.from('evento_inscricoes').select('*');

  const possible = [];

  loja?.forEach((p: any) => {
    if (p.status === 'pago' && Number(p.total) === 104.40) {
      possible.push({ source: 'loja', date: p.created_at, val: p.total });
    }
  });

  eventos?.forEach((i: any) => {
    if ((i.taxa_paga || (i.status || '').toLowerCase() === 'confirmada' || i.status === 'pago') && Number(i.valor_pago) === 104.40) {
      possible.push({ source: 'eventos', date: i.created_at, val: i.valor_pago });
    }
  });

  console.log("Records with exactly 104.40:", possible);
  
  // also sum 
  const validLoja = loja?.filter(p => p.status === 'pago' && new Date(p.created_at) >= limitStart && new Date(p.created_at) <= limitEnd) || [];
  const validEventos = eventos?.filter(i => (i.taxa_paga || (i.status || '').toLowerCase() === 'confirmada' || i.status === 'pago') && new Date(i.created_at) >= limitStart && new Date(i.created_at) <= limitEnd) || [];
  
  const sumLoja = validLoja.reduce((acc, p) => acc + Number(p.total||0), 0);
  const sumEventos = validEventos.reduce((acc, i) => acc + Number(i.valor_pago||0), 0);
  console.log("Total valid:", sumLoja + sumEventos);
}

run().catch(console.error);
