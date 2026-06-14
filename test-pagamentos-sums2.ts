import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data: matriculas, error } = await supabase.from('matriculas')
    .select('status, data_matricula, data_cancelamento, plano, turma, unidade, turma_id');
  const { data: turmas } = await supabase.from('turmas').select('id, valor_mensalidade, nome, unidade_nome');

  let totalProjetada = 0;
  const limitStart = new Date('2026-06-01T00:00:00Z');
  const limitEnd = new Date('2026-06-30T23:59:59Z');

  matriculas?.forEach((m: any) => {
    if (m.status !== 'ativo' && m.status !== 'Ativo') return;
    
    const enrolDate = m.data_matricula ? new Date(m.data_matricula) : null;
    const cancelDate = m.data_cancelamento ? new Date(m.data_cancelamento) : null;
    if (enrolDate && enrolDate > limitEnd) return;
    if (cancelDate && cancelDate < limitStart) return;

    const turma = turmas?.find((t: any) => String(t.id) === String(m.turma_id) || (t.nome === m.turma && t.unidade_nome === m.unidade));
    const price = turma?.valor_mensalidade || 0;
    
    totalProjetada += price;
  });

  console.log("Total Projetada (Active Enrollments in June):", totalProjetada);
}

run();
