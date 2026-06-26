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

  const validLoja = loja?.filter(p => p.status === 'pago' && new Date(p.created_at) >= limitStart && new Date(p.created_at) <= limitEnd) || [];
  const validEventos = eventos?.filter(i => (i.taxa_paga || (i.status || '').toLowerCase() === 'confirmada' || i.status === 'pago') && new Date(i.created_at) >= limitStart && new Date(i.created_at) <= limitEnd) || [];

  const items: any[] = [];
  validLoja.forEach(p => items.push({ id: p.id, type: 'loja', val: Number(p.total||0), date: p.created_at }));
  validEventos.forEach(i => items.push({ id: i.id, type: 'evento', val: Number(i.valor_pago||0), date: i.created_at }));

  console.log(`Total items: ${items.length}`);
  
  // Try to find a subset that sums to exactly 104.40
  // Since 104.40 could be a single item or combination of 2 items
  let found = false;
  for (let i = 0; i < items.length; i++) {
    if (Math.abs(items[i].val - 104.40) < 0.01) {
      console.log("Found single item:", items[i]);
      found = true;
    }
    for (let j = i + 1; j < items.length; j++) {
      if (Math.abs(items[i].val + items[j].val - 104.40) < 0.01) {
        console.log("Found pair:", items[i], items[j]);
        found = true;
      }
    }
  }
  if (!found) console.log("No single or pair found that sums to 104.40");
}

run().catch(console.error);
