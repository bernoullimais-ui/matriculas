import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data } = await supabase
    .from('conversas_whatsapp')
    .select('historico')
    .eq('telefone', '5571991414913')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (data?.historico) {
    console.log(JSON.stringify(data.historico.slice(-5).map((m: any) => ({
       role: m.role, text: m.parts?.[0]?.text, time: m.timestamp
    })), null, 2));
  } else {
    console.log('No data');
  }
}
run();
