import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data, error } = await supabase.from('pagamentos')
    .select('id, valor, status, data_pagamento, data_vencimento, created_at')
    .in('status', ['pago', 'conciliado'])
    .order('created_at', { ascending: false })
    .limit(10);
  console.log("pagamentos pagos:", data);
  if (error) console.log("Error:", error);
}

run();
