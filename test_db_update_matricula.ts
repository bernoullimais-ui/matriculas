import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('matriculas').update({ 
    status: 'Ativo',
    plano: 'Mensal',
    data_pagamento: new Date().toISOString()
  }).eq('id', '515d45b1-a63c-42a2-a4fa-640a74edeaea').select();
  console.log("Error:", error);
  console.log("Data:", data);
}
check();
