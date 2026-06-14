import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: feedInscricoes, error: eErr } = await supabase.from('evento_inscricoes')
    .select('id, created_at, nome_aluno, nome_responsavel, valor_pago, status, eventos(titulo)')
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log('feedInscricoes:', JSON.stringify(feedInscricoes, null, 2));
  console.log('error:', eErr);
}
test();
