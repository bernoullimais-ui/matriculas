import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  // Check inscricoes_eventos table
  const { data: inscricoes, error: iErr } = await supabase.from('inscricoes_eventos').select('id, created_at, nome_responsavel, evento_id').order('created_at', { ascending: false }).limit(5);
  console.log('inscricoes_eventos:', inscricoes);
  console.log('Error:', iErr);

  // Check pedidos_loja table
  const { data: pedidos, error: pErr } = await supabase.from('pedidos_loja').select('id, created_at, valor_total, cliente_nome, status').order('created_at', { ascending: false }).limit(5);
  console.log('pedidos_loja:', pedidos);
  console.log('Error:', pErr);
}
test();
