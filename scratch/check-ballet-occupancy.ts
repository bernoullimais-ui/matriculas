import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  console.log("=== CHECKING ENROLLMENTS FOR BALLET 1 IN BERNOULLI ===");

  // 1. Fetch from matriculas
  const { data: matriculas, error } = await supabase
    .from('matriculas')
    .select('*');

  if (error) {
    console.error("Error fetching matriculas:", error);
    return;
  }

  console.log(`Total matriculas in DB: ${matriculas.length}`);

  const activeBernoulliBallet = matriculas.filter(m => 
    String(m.turma).toLowerCase().includes('ballet 1') && 
    String(m.unidade).toLowerCase().includes('bernoulli')
  );

  console.log(`\nFiltered active and inactive Bernoulli Ballet 1 matriculas: ${activeBernoulliBallet.length}`);
  activeBernoulliBallet.forEach(m => {
    console.log(`- ID: ${m.id}, Aluno ID: ${m.aluno_id}, Status: ${m.status}, Unidade: "${m.unidade}", Turma: "${m.turma}", Horario: "${m.horario}", Cancelamento: ${m.data_cancelamento}`);
  });

  const activeOnly = activeBernoulliBallet.filter(m => m.status === 'ativo');
  console.log(`\nActive status only: ${activeOnly.length}`);
}

main();
