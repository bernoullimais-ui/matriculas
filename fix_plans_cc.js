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

async function fixCreditCardPlans() {
  console.log("Fetching all enrollments with missing plans...");
  
  // Buscar todas as matrículas sem plano
  const { data: matriculas, error: matError } = await supabase
    .from('matriculas')
    .select('id, turma, plano');

  if (matError) {
    console.error("Error fetching enrollments:", matError);
    return;
  }

  // Filtrar matrículas que não têm plano
  const missingPlanEnrollments = matriculas.filter(e => !e.plano || e.plano.trim() === '');
  console.log(`Found ${missingPlanEnrollments.length} enrollments missing plans.`);

  let fixedCount = 0;

  for (const enrollment of missingPlanEnrollments) {
    // Buscar pagamento vinculado a essa matrícula
    const { data: pagamentos, error: pagError } = await supabase
      .from('pagamentos')
      .select('metodo_pagamento')
      .eq('matricula_id', enrollment.id)
      .limit(1);

    if (pagError) {
      console.error(`Error fetching pagamentos for matricula ${enrollment.id}:`, pagError);
      continue;
    }

    if (pagamentos && pagamentos.length > 0) {
      const metodo = pagamentos[0].metodo_pagamento;
      if (metodo && metodo.toLowerCase().includes('cartao_credito')) {
        console.log(`Fixing enrollment ${enrollment.id} (Turma: ${enrollment.turma}) => Has Credit Card. Applying plan: "${enrollment.turma}"`);
        
        const { error: updateError } = await supabase
          .from('matriculas')
          .update({ plano: enrollment.turma })
          .eq('id', enrollment.id);

        if (updateError) {
          console.error(`Error updating enrollment ${enrollment.id}:`, updateError);
        } else {
          fixedCount++;
        }
      }
    }
  }

  console.log(`Finished fixing credit card plans. Successfully fixed ${fixedCount} records.`);
}

fixCreditCardPlans();
