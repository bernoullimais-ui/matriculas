import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: tablesData, error: tablesError } = await supabase.rpc('get_tables_with_column', { column_name: 'responsavel_id' });
  if (tablesError) {
    console.log("RPC get_tables_with_column might not exist, trying pg_meta");
    // Fallback: just list a bunch of known tables to check
    const tables = ['alunos', 'matriculas', 'pagamentos', 'pagamentos_logs', 'evento_inscricoes', 'cupom_usos', 'loja_pedidos', 'admin_logs', 'avaliacoes', 'frequencias', 'turmas', 'mensagens'];
    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('responsavel_id').limit(1);
      if (!error) console.log(`Table ${table} HAS responsavel_id`);
    }
  } else {
    console.log(tablesData);
  }
}
run();
