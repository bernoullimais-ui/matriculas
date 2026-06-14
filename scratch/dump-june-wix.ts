import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function dump() {
  const { data, error } = await supabase
    .from('pagamentos_wix')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) {
    console.error("Error:", error);
    return;
  }

  const filtered = data.filter(w => {
    const dStr = w.data_pagamento_gmt_03 || w.created_at;
    if (!dStr) return false;
    const d = new Date(dStr);
    return d >= new Date("2026-06-04T00:00:00") && d <= new Date("2026-06-05T23:59:59");
  });

  console.log(`Found ${filtered.length} raw Wix payments in June 4 & 5:`);
  filtered.forEach((w, idx) => {
    console.log(`\n[${idx}] ID: ${w.id}`);
    console.log(`  id_provedor_pagamento: ${w.id_provedor_pagamento}`);
    console.log(`  responsavel_id: ${w.responsavel_id}`);
    console.log(`  aluno_id: ${w.aluno_id}`);
    console.log(`  matricula_id: ${w.matricula_id}`);
    console.log(`  valor: ${w.valor}`);
    console.log(`  status_transacao: ${w.status_transacao}`);
    console.log(`  data_pagamento_gmt_03: ${w.data_pagamento_gmt_03}`);
    console.log(`  created_at: ${w.created_at}`);
    console.log(`  tipo_pedido: ${w.tipo_pedido}`);
  });
}

dump();
