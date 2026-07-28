import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data, error } = await supabase.from('conversas_whatsapp').select('id, telefone, historico, created_at').like('telefone', '%30457777%');
  console.log('Conversations with business phone as customer:', data);
}
run();
