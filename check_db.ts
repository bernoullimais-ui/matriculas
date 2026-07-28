import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data } = await supabase.from('conversas_whatsapp').select('historico').eq('id', '2427e444-2a44-42e7-97eb-c5a00c333610').single();
  console.log(data?.historico);
}
run();
