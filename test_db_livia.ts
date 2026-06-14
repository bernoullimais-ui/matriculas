import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: alunos } = await supabase.from('alunos').select('*').ilike('email', '%trindadelivia%');
  console.log("Alunos:", alunos);
  
  const { data: pagamentos } = await supabase.from('pagamentos').select('*').ilike('customer_email', '%trindadelivia%');
  console.log("Pagamentos:", pagamentos);
}
check();
