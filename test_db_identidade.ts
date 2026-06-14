import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: mapping } = await supabase.from('unidades_mapping').select('*').eq('nome', 'Kids Sport Club').single();
  console.log("Mapping:", mapping);
  if (mapping && mapping.identidade) {
    const { data: ident } = await supabase.from('identidades').select('nome, modelo_pagamento, pagarme_api_key, pagarme_recipient_id').eq('nome', mapping.identidade).single();
    console.log("Identidade:", ident);
  }
}
check();
