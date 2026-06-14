import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function check() {
  const { data, error } = await supabase
    .from('pagamentos')
    .select('id, matricula_id, valor, status, pagarme')
    .eq('id', '8d6870a1-b29d-42b2-bedd-6d1a463f130d')
    .single();
  console.log('Payment:', data, error);
}
check();
