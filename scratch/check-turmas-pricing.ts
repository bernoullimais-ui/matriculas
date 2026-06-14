import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

async function run() {
  const { data: turmas } = await supabase.from('turmas').select('id, nome, valor_mensalidade, unidade_nome');
  if (!turmas) return;

  console.log(`Total classes: ${turmas.length}`);
  
  const priceCounts: Record<number, number> = {};
  const sampleClasses: any[] = [];
  
  turmas.forEach(t => {
    const p = t.valor_mensalidade || 0;
    priceCounts[p] = (priceCounts[p] || 0) + 1;
    if (sampleClasses.length < 10) sampleClasses.push(t);
  });
  
  console.log('Unique prices in database and their counts:', priceCounts);
  console.log('Sample classes:', sampleClasses);
}

run();
