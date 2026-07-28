import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data: conv } = await supabase
    .from('conversas_whatsapp')
    .select('id, telefone, historico, created_at, status')
    .eq('telefone', '5571999174731')
    .order('created_at', { ascending: false });
  
  conv?.forEach(c => {
    console.log('ID:', c.id, 'Status:', c.status);
    c.historico.forEach((m: any) => {
      console.log(`[${m.timestamp}] ${m.role}: ${JSON.stringify(m.parts)}`);
    });
  });
}
run();
