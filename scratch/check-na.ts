import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("=== INSPECTING IDENTIDADES TABLE ===");
  const { data, error } = await supabase
    .from('identidades')
    .select('*');

  if (error) {
    console.error("Error:", error.message);
    return;
  }

  console.log(`Retrieved ${data?.length} identidades:`);
  for (const r of data || []) {
    console.log(`- ID: ${r.id}, Nome: ${r.nome}, Modelo: ${r.modelo_pagamento}, Has Pagarme Key: ${!!r.pagarme_api_key}, Pagarme Key Prefix: ${r.pagarme_api_key ? r.pagarme_api_key.substring(0, 8) : null}, Recipient ID: ${r.pagarme_recipient_id}`);
  }
}

check();
