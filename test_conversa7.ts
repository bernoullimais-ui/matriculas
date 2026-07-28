import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data: conv } = await supabase
    .from('conversas_whatsapp')
    .select('id, telefone, identidade_nome, historico, created_at, status')
    .eq('telefone', '5571991414913')
    .order('created_at', { ascending: false })
    .limit(3);
  
  console.log(conv?.map(c => ({
    id: c.id,
    identidade: c.identidade_nome,
    created: c.created_at,
    status: c.status,
    lastMsg: c.historico?.slice(-1)[0]?.parts?.[0]?.text
  })));
}
run();
