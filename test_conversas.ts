import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data: conversas } = await supabase
    .from('conversas_whatsapp')
    .select('id, telefone, status')
    .in('status', ['ativo', 'escalado'])
    .limit(2);
    
  if (conversas && conversas.length > 0) {
    const telefones = Array.from(new Set(conversas.map(c => c.telefone)));
    console.log('Telefones found:', telefones);
    
    const { data: allSessions } = await supabase
      .from('conversas_whatsapp')
      .select('id, telefone, status')
      .in('telefone', telefones)
      .order('created_at', { ascending: false });
      
    console.log('All sessions for these phones:', allSessions);
  }
}
run();
