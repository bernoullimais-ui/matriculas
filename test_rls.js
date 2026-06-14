import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
async function run() {
  const res = await fetch(`${process.env.APP_URL}/api/settings/bulk?keys=loja_max_parcelas,loja_min_valor_parcela`);
  const text = await res.text();
  console.log("Endpoint res:", text);
}
run();
