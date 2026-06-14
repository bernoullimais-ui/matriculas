import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: evInsc, error: e1 } = await supabase.from('evento_inscricoes').select('*').limit(1);
  console.log('evento_inscricoes columns:', Object.keys(evInsc?.[0] || {}));
  console.log('evento_inscricoes sample:', evInsc?.[0]);
  
  const { data: lojaPedidos, error: e2 } = await supabase.from('loja_pedidos').select('*').limit(1);
  console.log('loja_pedidos columns:', Object.keys(lojaPedidos?.[0] || {}));
  console.log('loja_pedidos sample:', lojaPedidos?.[0]);
}
test();
