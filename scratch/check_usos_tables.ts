import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const r1 = await supabase.from('cupom_usos').select('*').limit(1);
  console.log("cupom_usos error:", r1.error?.message);
  console.log("cupom_usos sample:", r1.data);

  const r2 = await supabase.from('cupons_usos').select('*').limit(1);
  console.log("cupons_usos error:", r2.error?.message);
  console.log("cupons_usos sample:", r2.data);
}
run();
