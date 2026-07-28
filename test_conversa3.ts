import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data: conv, error } = await supabase
    .from('conversas_whatsapp')
    .select('id, telefone, identidade_nome, status, historico, created_at')
    .eq('identidade_nome', 'B+')
    .order('created_at', { ascending: false });
  if (error) console.error(error);
  console.log('Conversations for B+:', conv?.length);
  if (conv && conv.length > 0) {
    console.log(conv[0].telefone, conv[0].created_at, conv[0].status);
  }
}
run();
