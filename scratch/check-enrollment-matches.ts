import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

async function run() {
  const [mRes, tRes] = await Promise.all([
    supabase.from('matriculas').select('*'),
    supabase.from('turmas').select('*')
  ]);

  const matriculas = mRes.data || [];
  const turmas = tRes.data || [];

  let matchedById = 0;
  let matchedByNameAndUnit = 0;
  let unmatched = 0;
  
  const unmatchedSamples: any[] = [];

  matriculas.forEach((m: any) => {
    if (m.status !== 'ativo' && m.status !== 'Ativo') return;

    const byId = turmas.find(t => String(t.id) === String(m.turma_id));
    if (byId) {
      matchedById++;
      return;
    }

    const byNameAndUnit = turmas.find(t => t.nome === m.turma && t.unidade_nome === m.unidade);
    if (byNameAndUnit) {
      matchedByNameAndUnit++;
      return;
    }

    unmatched++;
    if (unmatchedSamples.length < 10) {
      unmatchedSamples.push({
        id: m.id,
        turma_id: m.turma_id,
        turma: m.turma,
        unidade: m.unidade
      });
    }
  });

  console.log(`Matching results:`);
  console.log(`  Matched by ID: ${matchedById}`);
  console.log(`  Matched by Name and Unit: ${matchedByNameAndUnit}`);
  console.log(`  Unmatched: ${unmatched}`);
  console.log(`Unmatched samples:`, unmatchedSamples);
}

run();
