import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function test() {
  const { data: cols, error } = await supabase.rpc('get_table_columns', { table_name: 'loja_produtos' });
  console.log("loja_produtos cols:", error || cols?.map(c => c.column_name).join(', '));
  
  const { data: cols2, error: error2 } = await supabase.rpc('get_table_columns', { table_name: 'loja_pedidos' });
  console.log("loja_pedidos cols:", error2 || cols2?.map(c => c.column_name).join(', '));
}
test();
