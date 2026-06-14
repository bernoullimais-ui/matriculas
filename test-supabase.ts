import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data, error } = await supabase.from('matriculas')
    .select('id, created_at, status, alunos(nome_completo), turmas(nome)')
    .limit(2);
  console.log("feedMatriculas:", data);
  if (error) console.log("feedMatriculas Error:", error);

  const { data: d2, error: e2 } = await supabase.from('matriculas')
    .select('id, data_cancelamento, status, alunos(nome_completo), turmas(nome)')
    .not('data_cancelamento', 'is', null)
    .limit(2);
  console.log("feedCancelamentos:", d2);
  if (e2) console.log("feedCancelamentos Error:", e2);

  const { data: d3, error: e3 } = await supabase.from('matriculas')
    .select('id, aluno_id, data_cancelamento, alunos(nome_completo), turmas(nome)')
    .in('status', ['transferido', 'Transferido'])
    .not('data_cancelamento', 'is', null)
    .limit(2);
  console.log("feedTransferencias:", d3);
  if (e3) console.log("feedTransferencias Error:", e3);
}

run();
