import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: cupom_usos, error: e1 } = await supabase.from('cupom_usos').select('*').limit(2);
  console.log('cupom_usos items:', cupom_usos, 'err:', e1?.message);
  
  const { data: cupons_usos, error: e2 } = await supabase.from('cupons_usos').select('*').limit(2);
  console.log('cupons_usos items:', cupons_usos, 'err:', e2?.message);
}
test();
