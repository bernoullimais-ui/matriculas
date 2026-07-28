import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data: conv, error } = await supabase
    .from('conversas_whatsapp')
    .select('id, identidade_nome, historico')
    .eq('telefone', '5571991414913')
    .neq('status', 'encerrado')
    .order('created_at', { ascending: false });
  if (error) console.error(error);
  console.log('Active conversations:', conv?.length);
  if (conv && conv.length > 0) {
    console.log(conv[0].identidade_nome);
    console.log(JSON.stringify(conv[0].historico.slice(-5), null, 2));
  }
}
run();
