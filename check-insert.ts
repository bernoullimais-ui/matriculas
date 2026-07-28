import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data, error } = await supabase.from('campaign_emails').insert([{
    campaign_id: '98f32307-53d7-4eb4-a575-428be231e2b0',
    assunto: '',
    formato: 'texto',
    conteudo: 'Teste whatsapp',
    remetente_email: '',
    remetente_nome: '',
    imagem_url: '',
    meta_template_name: ''
  }]);
  console.log("Error:", error);
}
run();
