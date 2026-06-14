import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('cupons').select('id, codigo, limite_por_usuario');
  console.log('Total coupons:', data?.length);
  const nullLimit = data?.filter(c => c.limite_por_usuario === null);
  console.log('Coupons with null limite_por_usuario:', nullLimit?.length);
  console.log('Sample of null limit coupons:', nullLimit?.slice(0, 3));
  console.log('Sample of non-null limit coupons:', data?.filter(c => c.limite_por_usuario !== null).slice(0, 3));
}
test();
