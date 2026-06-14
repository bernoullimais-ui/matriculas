import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("=== CHECKING WIX PAYMENTS IN DB ===");
  const { data, error } = await supabase
    .from('pagamentos_wix')
    .select('*')
    .gte('data_pagamento_gmt_03', '2026-06-04T00:00:00')
    .lte('data_pagamento_gmt_03', '2026-06-06T23:59:59');

  if (error) {
    console.error("Error fetching:", error);
  } else {
    console.log(`Found ${data?.length || 0} rows in date range:`);
    data?.forEach(row => {
      console.log(`- Date: ${row.data_pagamento_gmt_03}, ID: ${row.id_provedor_pagamento}, Name: ${row.cobranca_nome}, Email: ${row.cobranca_email}, Plan: ${row.produto_nome}, Value: ${row.valor}, Status: ${row.status_transacao}, Provedor: ${row.provedor_pagamento}`);
    });
  }
}

check();
