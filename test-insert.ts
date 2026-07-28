import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data: campaign, error: cErr } = await supabase.from('campaigns').insert([{
    nome: 'Teste', slug: 'teste', tipo: 'ambos', status: 'rascunho', metodo_envio: 'whatsapp'
  }]).select().single();
  
  if (cErr) { console.error('cErr', cErr); return; }
  console.log('Campaign created', campaign.id);
  
  const res = await supabase.from('campaign_emails').insert([{
    campaign_id: campaign.id,
    assunto: '',
    formato: 'texto',
    conteudo: 'Teste de conteudo',
    remetente_email: '',
    remetente_nome: ''
  }]);
  
  console.log('Insert result:', res);
  
  await supabase.from('campaigns').delete().eq('id', campaign.id);
}
run();
