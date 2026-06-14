import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  console.log("=== COUNTING MATRICULAS IN DB ===");

  // Count active matriculas (case-sensitive 'ativo')
  const { count: countAtivo, error: err1 } = await supabase
    .from('matriculas')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'ativo');
    
  console.log("Count with status='ativo':", countAtivo);

  // Count active matriculas (case-sensitive 'Ativo')
  const { count: countAtivoCaps, error: err2 } = await supabase
    .from('matriculas')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Ativo');

  console.log("Count with status='Ativo':", countAtivoCaps);

  // Count with status in ('ativo', 'Ativo')
  const { count: countTotalActive, error: err3 } = await supabase
    .from('matriculas')
    .select('*', { count: 'exact', head: true })
    .in('status', ['ativo', 'Ativo']);

  console.log("Count with status in ['ativo', 'Ativo']:", countTotalActive);

  // Count all where status is not cancelled
  const { count: countNotCanceled, error: err4 } = await supabase
    .from('matriculas')
    .select('*', { count: 'exact', head: true })
    .not('status', 'eq', 'cancelado');

  console.log("Count with status != 'cancelado':", countNotCanceled);

  // Let's count how many Bernoulli Ballet 1 matriculas are active (case-insensitive) using a query
  const { data: bernoulliBallet, error: err5 } = await supabase
    .from('matriculas')
    .select('*')
    .eq('unidade', 'Colégio Bernoulli')
    .eq('turma', 'Ballet 1');

  if (bernoulliBallet) {
    console.log(`\nExact match for 'Colégio Bernoulli' & 'Ballet 1' (Total: ${bernoulliBallet.length}):`);
    bernoulliBallet.forEach(m => {
      console.log(`- ID: ${m.id}, Status: "${m.status}", Cancelado em: ${m.data_cancelamento}`);
    });
  }
}

main();
