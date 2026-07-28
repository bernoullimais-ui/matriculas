import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data: conv } = await supabase
    .from('conversas_whatsapp')
    .select('id, historico, created_at')
    .eq('telefone', '5571991414913')
    .eq('identidade_nome', 'Sport for Kids')
    .order('created_at', { ascending: false });
  if (conv && conv.length > 0) {
    // Find the one created around 12:03 UTC
    const target = conv.find(c => c.created_at.includes('2026-07-16T12:03'));
    if (target) {
      console.log('Found target conversation:', target.id);
      target.historico.forEach(m => {
        console.log(`[${m.timestamp}] ${m.role}: ${JSON.stringify(m.parts)}`);
      });
    } else {
      console.log('Target conversation not found. Found:', conv.map(c => c.created_at));
    }
  }
}
run();
