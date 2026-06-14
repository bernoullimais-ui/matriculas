import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

async function run() {
  const [mRes, tRes] = await Promise.all([
    supabase.from('matriculas').select('*').limit(10000),
    supabase.from('turmas').select('*').limit(10000)
  ]);

  const rawMatriculas = mRes.data || [];
  const turmas = tRes.data || [];

  // Enrich like in the server
  const matriculas = rawMatriculas.map(m => {
    if (!m.unidade || !m.turma) {
      const t = turmas.find(tr => String(tr.id) === String(m.turma_id));
      if (t) {
        return {
          ...m,
          unidade: m.unidade || t.unidade_nome,
          turma: m.turma || t.nome
        };
      }
    }
    return m;
  });

  const limitStart = new Date('2026-08-01');
  const limitEnd = new Date('2026-08-31T23:59:59Z');

  // Filter raw enrollments (for Receita Projetada)
  const filteredEnrollments = matriculas.filter((m: any) => {
    // Status check
    if (m.status !== 'ativo' && m.status !== 'Ativo') return false;

    // Date window check
    const enrolDate = m.data_matricula ? new Date(m.data_matricula) : null;
    const cancelDate = m.data_cancelamento ? new Date(m.data_cancelamento) : null;
    if (enrolDate && enrolDate > limitEnd) return false;
    if (cancelDate && cancelDate < limitStart) return false;

    return true;
  });

  console.log(`Local simulation results:`);
  console.log(`  rawMatriculas total count: ${rawMatriculas.length}`);
  console.log(`  matriculas total count (enriched): ${matriculas.length}`);
  console.log(`  filteredEnrollments count: ${filteredEnrollments.length}`);
}

run();
