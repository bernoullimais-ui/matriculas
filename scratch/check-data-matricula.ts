import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

async function run() {
  const { data: matriculas } = await supabase.from('matriculas').select('id, data_matricula, status').limit(10000);
  if (!matriculas) return;

  const active = matriculas.filter(m => m.status === 'ativo' || m.status === 'Ativo');
  console.log(`Total active enrollments: ${active.length}`);

  const months: Record<string, number> = {};
  active.forEach(m => {
    if (!m.data_matricula) {
      months['NULL'] = (months['NULL'] || 0) + 1;
    } else {
      const ym = m.data_matricula.substring(0, 7);
      months[ym] = (months[ym] || 0) + 1;
    }
  });

  console.log('Active enrollments by data_matricula month:', months);
}

run();
