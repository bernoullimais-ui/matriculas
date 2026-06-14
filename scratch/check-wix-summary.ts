import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("=== SUMMARIZING WIX PAYMENTS IN DB ===");
  const { data, error } = await supabase
    .from('pagamentos_wix')
    .select('status_transacao, valor, provedor_pagamento, data_pagamento_gmt_03')
    .order('data_pagamento_gmt_03', { ascending: false });

  if (error) {
    console.error("Error fetching:", error);
    return;
  }

  console.log(`Total rows: ${data?.length}`);
  
  // Count by status
  const statuses: Record<string, number> = {};
  const values: Record<number, number> = {};
  const dateSamples: string[] = [];

  data?.forEach((row, idx) => {
    statuses[row.status_transacao] = (statuses[row.status_transacao] || 0) + 1;
    values[row.valor] = (values[row.valor] || 0) + 1;
    if (idx < 5) {
      dateSamples.push(`${row.data_pagamento_gmt_03} (${row.valor} - ${row.status_transacao})`);
    }
  });

  console.log("Status distribution:", statuses);
  console.log("Value distribution:", values);
  console.log("Latest 5 records:", dateSamples);
}

check();
