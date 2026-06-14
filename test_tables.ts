import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  // Try inscricoes
  const { data: i1, error: e1 } = await supabase.from('inscricoes').select('id, created_at').limit(3);
  console.log('inscricoes:', i1, 'err:', e1?.message);
  
  const { data: i2, error: e2 } = await supabase.from('evento_inscricoes').select('id, created_at').limit(3);
  console.log('evento_inscricoes:', i2, 'err:', e2?.message);
  
  const { data: i3, error: e3 } = await supabase.from('loja_pedidos').select('id, created_at').limit(3);
  console.log('loja_pedidos:', i3, 'err:', e3?.message);
  
  const { data: i4, error: e4 } = await supabase.from('loja_pedidos_solicitacoes').select('id, created_at').limit(3);
  console.log('loja_pedidos_solicitacoes:', i4, 'err:', e4?.message);
  
  // check columns for inscricoes if exists
  if (i1 && i1.length > 0) {
    const { data: fullI, error: fullE } = await supabase.from('inscricoes').select('*').limit(1);
    console.log('inscricoes full row:', Object.keys(fullI?.[0] || {}));
  }
}
test();
