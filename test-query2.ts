import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data, error } = await supabase.from('cupons').select('id, codigo, escopo, tipo_desconto, tipo, aplicar_em').order('created_at', { ascending: false }).limit(5);
  console.log("Data:", data);
}
run();
