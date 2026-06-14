import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('pagamentos').select('*').eq('id', '98edbddf-8898-4421-97df-c3b802d96a4f');
  console.log("Pagamento:", data, error);
  
  const { data: evento, error: errEvento } = await supabase.from('evento_inscricoes').select('*').eq('pagamento_id', '98edbddf-8898-4421-97df-c3b802d96a4f');
  console.log("Evento Inscricao:", evento, errEvento);
  
  const { data: logs, error: errLogs } = await supabase.from('pagamentos_logs').select('*').eq('pagamento_id', '98edbddf-8898-4421-97df-c3b802d96a4f');
  console.log("Logs:", logs, errLogs);
}
run();
