import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const r1 = await supabase.from('loja_pedidos').select('total, status, provedor_pagamento, created_at').limit(1);
  console.log('Loja:', r1.error);
  
  const r2 = await supabase.from('evento_inscricoes').select('valor_pago, status, taxa_paga, provedor_pagamento, created_at').limit(1);
  console.log('Eventos:', r2.error);
}

run().catch(console.error);
