import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

async function run() {
  console.log("=== CHECKING WEBHOOK ENTRIES IN DATABASE ===");
  const { data: webhookPayments, error } = await supabase
    .from('pagamentos_wix')
    .select('id, id_provedor_pagamento, status_transacao, cobranca_email, produto_nome, created_at')
    .eq('provedor_pagamento', 'Wix Webhook')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching webhook payments:", error);
    return;
  }

  console.log(`Found ${webhookPayments?.length || 0} payments from Wix Webhook.`);
  if (webhookPayments && webhookPayments.length > 0) {
    console.log("Most recent 5 entries:");
    console.table(webhookPayments.slice(0, 5));
  }
}

run();
