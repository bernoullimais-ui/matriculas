import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixMissingPlans() {
  console.log("Fetching all active enrollments...");
  
  // Encontrar TODAS as matrículas ativas
  const { data: activeEnrollments, error: activeError } = await supabase
    .from('matriculas')
    .select('id, aluno_id, status, plano, created_at, turma')
    .ilike('status', 'ativo');

  if (activeError) {
    console.error("Error fetching active enrollments:", activeError);
    return;
  }

  // Filtrar matrículas que realmente não têm plano (nulo ou vazio)
  const missingPlanEnrollments = activeEnrollments.filter(e => !e.plano || e.plano.trim() === '');

  console.log(`Found ${missingPlanEnrollments.length} active enrollments with missing plans.`);
  
  let fixedCount = 0;

  for (const enrollment of missingPlanEnrollments) {
    // Procurar qualquer matrícula anterior do mesmo aluno que POSSUA plano preenchido
    const { data: pastEnrollments, error: pastError } = await supabase
      .from('matriculas')
      .select('plano, status, turma')
      .eq('aluno_id', enrollment.aluno_id)
      .not('id', 'eq', enrollment.id) // Não ser a mesma
      .order('created_at', { ascending: false });

    if (pastError) {
      console.error(`Error fetching past enrollments for student ${enrollment.aluno_id}:`, pastError);
      continue;
    }

    // Filtrar apenas as que têm um plano válido
    const validPastEnrollments = (pastEnrollments || []).filter(p => p.plano && p.plano.trim() !== '');

    if (validPastEnrollments.length > 0) {
      const pastPlan = validPastEnrollments[0].plano;
      
      const { data: alunoInfo } = await supabase.from('alunos').select('nome_completo').eq('id', enrollment.aluno_id).single();
      const studentName = alunoInfo ? alunoInfo.nome_completo : enrollment.aluno_id;

      console.log(`Fixing enrollment for student [${studentName}] (Turma: ${enrollment.turma}) => Applying plan: "${pastPlan}"`);
      
      const { error: updateError } = await supabase
        .from('matriculas')
        .update({ plano: pastPlan })
        .eq('id', enrollment.id);
        
      if (updateError) {
        console.error(`Error updating enrollment ${enrollment.id}:`, updateError);
      } else {
        fixedCount++;
      }
    } else {
      const { data: alunoInfo } = await supabase.from('alunos').select('nome_completo').eq('id', enrollment.aluno_id).single();
      const studentName = alunoInfo ? alunoInfo.nome_completo : enrollment.aluno_id;
      console.log(`Could not find a valid past plan for student [${studentName}] (Turma: ${enrollment.turma})`);
    }
  }

  console.log(`Finished fixing plans. Successfully fixed ${fixedCount} records.`);
}

fixMissingPlans();
