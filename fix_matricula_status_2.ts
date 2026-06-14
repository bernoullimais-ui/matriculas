import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function reset() {
  await supabase.from('matriculas').update({ status: 'Pendente', pagarme_subscription_id: null, data_pagamento: null }).eq('id', '515d45b1-a63c-42a2-a4fa-640a74edeaea');
  console.log("Matricula resetada.");
}
reset();
