import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data: loja } = await supabase.from('loja_pedidos').select('id, total, status, created_at');
  const { data: eventos } = await supabase.from('evento_inscricoes').select('id, valor_pago, status, taxa_paga, created_at');

  console.log("Loja Items:");
  loja?.forEach(p => {
    if (p.status === 'pago') console.log(`Loja: ${p.created_at} - ${p.total}`);
  });

  console.log("Evento Items:");
  eventos?.forEach(i => {
    if (i.taxa_paga || (i.status || '').toLowerCase() === 'confirmada' || i.status === 'pago') {
      console.log(`Evento: ${i.created_at} - ${i.valor_pago}`);
    }
  });
}

run().catch(console.error);
