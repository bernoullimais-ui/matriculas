import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

async function run() {
  const [mRes, tRes] = await Promise.all([
    supabase.from('matriculas').select('*').limit(10000),
    supabase.from('turmas').select('*').limit(10000)
  ]);

  const matriculas = mRes.data || [];
  const turmas = tRes.data || [];

  const limitStart = new Date('2026-08-01');
  const limitEnd = new Date('2026-08-31T23:59:59Z');

  // Filter raw enrollments like in the frontend
  const filtered = matriculas.filter((m: any) => {
    if (m.status !== 'ativo' && m.status !== 'Ativo') return false;

    const enrolDate = m.data_matricula ? new Date(m.data_matricula) : null;
    const cancelDate = m.data_cancelamento ? new Date(m.data_cancelamento) : null;
    if (enrolDate && enrolDate > limitEnd) return false;
    if (cancelDate && cancelDate < limitStart) return false;

    return true;
  });

  console.log(`Filtered Active Enrollments in August 2026: ${filtered.length}`);

  let matched = 0;
  let unmatched = 0;
  let matchedButZeroPrice = 0;

  const unmatchedClasses: Record<string, number> = {};

  filtered.forEach((m: any) => {
    const turma = turmas.find((t: any) => String(t.id) === String(m.turma_id) || (t.nome === m.turma && t.unidade_nome === m.unidade));
    if (turma) {
      matched++;
      if (!turma.valor_mensalidade) matchedButZeroPrice++;
    } else {
      unmatched++;
      const key = `${m.turma} (${m.unidade})`;
      unmatchedClasses[key] = (unmatchedClasses[key] || 0) + 1;
    }
  });

  console.log(`Matching details for August 2026:`);
  console.log(`  Total active: ${filtered.length}`);
  console.log(`  Matched classes: ${matched}`);
  console.log(`  Matched but 0 price: ${matchedButZeroPrice}`);
  console.log(`  Unmatched classes: ${unmatched}`);
  console.log(`Unmatched classes sample counts:`, unmatchedClasses);
}

run();
