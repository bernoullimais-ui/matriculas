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
  console.log("Fetching active enrollments with missing plans...");
  
  // Encontrar todas as matrículas ativas sem plano
  const { data: activeEnrollments, error: activeError } = await supabase
    .from('matriculas')
    .select('id, aluno_id, status, plano, created_at')
    .ilike('status', 'ativo')
    .is('plano', null);

  if (activeError) {
    console.error("Error fetching active enrollments:", activeError);
    return;
  }

  if (!activeEnrollments || activeEnrollments.length === 0) {
    console.log("No active enrollments with missing plans found.");
    return;
  }

  console.log(`Found ${activeEnrollments.length} active enrollments missing plans.`);
  
  let fixedCount = 0;

  for (const enrollment of activeEnrollments) {
    // Procurar matrículas anteriores transferidas do mesmo aluno que possuam plano
    const { data: pastEnrollments, error: pastError } = await supabase
      .from('matriculas')
      .select('plano')
      .eq('aluno_id', enrollment.aluno_id)
      .ilike('status', 'transferido')
      .not('plano', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (pastError) {
      console.error(`Error fetching past enrollments for student ${enrollment.aluno_id}:`, pastError);
      continue;
    }

    if (pastEnrollments && pastEnrollments.length > 0) {
      const pastPlan = pastEnrollments[0].plano;
      console.log(`Fixing enrollment ${enrollment.id} with plan: ${pastPlan}`);
      
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
      console.log(`Could not find a past plan for student ${enrollment.aluno_id} (Enrollment ${enrollment.id})`);
    }
  }

  console.log(`Finished fixing plans. Successfully fixed ${fixedCount} records.`);
}

fixMissingPlans();
