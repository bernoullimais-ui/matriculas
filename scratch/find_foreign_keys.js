import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // Try querying a few tables to see if they have responsavel_id
  const tables = ['alunos', 'matriculas', 'pagamentos', 'evento_inscricoes', 'cupom_usos', 'loja_pedidos'];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('responsavel_id').limit(1);
    if (!error) {
      console.log(`Table ${table} HAS responsavel_id`);
    } else {
      console.log(`Table ${table} does NOT have responsavel_id (or error: ${error.message})`);
    }
  }
}
run();
