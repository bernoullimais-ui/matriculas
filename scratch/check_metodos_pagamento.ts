import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

async function run() {
  console.log("=== CHECKING UNIQUE METODOS DE PAGAMENTO AND STATUS ===");
  
  const { data, error } = await supabase
    .from('pagamentos')
    .select('metodo_pagamento, status');

  if (error) {
    console.error("Error fetching data:", error);
    return;
  }

  const metodos = new Set<string>();
  const statusValues = new Set<string>();
  
  for (const row of data || []) {
    if (row.metodo_pagamento) metodos.add(row.metodo_pagamento);
    if (row.status) statusValues.add(row.status);
  }

  console.log("Unique metodo_pagamento values:", Array.from(metodos));
  console.log("Unique status values:", Array.from(statusValues));
}

run();
