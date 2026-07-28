import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data: conv } = await supabase
    .from('conversas_whatsapp')
    .select('id, telefone, identidade_nome, historico, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log(conv?.map(c => ({ tel: c.telefone, ident: c.identidade_nome, created: c.created_at })));
}
run();
