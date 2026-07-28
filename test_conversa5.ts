import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data: conv } = await supabase
    .from('conversas_whatsapp')
    .select('id, historico, created_at, status')
    .eq('id', 'e5beaa30-6eec-42a8-bce1-d4399f39a3fe')
    .single();
  if (conv) {
    console.log('Status:', conv.status);
    conv.historico.forEach(m => {
      console.log(`[${m.timestamp}] ${m.role}: ${JSON.stringify(m.parts)}`);
    });
  }
}
run();
