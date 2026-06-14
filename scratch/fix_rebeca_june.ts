import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

async function run() {
  console.log("Correcting Rebeca's June 2nd payment status in database...");
  
  const { data, error } = await supabase
    .from('pagamentos_wix')
    .update({ status_transacao: 'Recusado' })
    .eq('id_provedor_pagamento', '05caf720-7863-4f64-8653-51e4b52736b1-cycle-4')
    .select();

  if (error) {
    console.error("Error updating status:", error);
    return;
  }

  console.log("Updated record successfully:", JSON.stringify(data, null, 2));
}

run();
