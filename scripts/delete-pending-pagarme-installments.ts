import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const isDryRun = process.argv.includes('--execute') ? false : true;
  console.log(`=== RUNNING DELETION SCRIPT (${isDryRun ? 'DRY RUN' : 'EXECUTE MODE'}) ===`);

  // 1. Fetch all matriculas with a pagarme_subscription_id
  const { data: matriculas, error: mError } = await supabase
    .from('matriculas')
    .select('id, status, unidade, turma, pagarme_subscription_id, aluno_id, alunos(nome_completo)')
    .not('pagarme_subscription_id', 'is', null);

  if (mError) {
    console.error("Error fetching matriculas:", mError);
    return;
  }

  console.log(`Found ${matriculas.length} matriculas with Pagar.me subscriptions.`);

  let totalDeleted = 0;
  const deleteIds: string[] = [];

  for (const matricula of matriculas) {
    const alunoNome = (matricula.alunos as any)?.nome_completo || 'Unknown Aluno';
    
    // Fetch all credit card installments for this matricula
    const { data: installments, error: pError } = await supabase
      .from('pagamentos')
      .select('id, status, data_vencimento, valor, metodo_pagamento')
      .eq('matricula_id', matricula.id)
      .eq('metodo_pagamento', 'cartao_credito')
      .order('data_vencimento', { ascending: true });

    if (pError) {
      console.error(`Error fetching payments for matricula ${matricula.id}:`, pError);
      continue;
    }

    if (!installments || installments.length === 0) {
      continue;
    }

    const paidInstallments = installments.filter(inst => inst.status === 'pago');
    const pendingInstallments = installments.filter(inst => inst.status === 'pendente');

    let toDelete: any[] = [];

    if (paidInstallments.length > 0) {
      // Enrollment is active and paid at least once. We can delete ALL pending credit card installments.
      toDelete = [...pendingInstallments];
    } else {
      // Enrollment has no paid installments. We must keep the oldest pending one (activation payment)
      // and delete all subsequent pending ones.
      if (pendingInstallments.length > 1) {
        toDelete = pendingInstallments.slice(1);
      }
    }

    if (toDelete.length > 0) {
      console.log(`Matricula: ${matricula.id} | Aluno: ${alunoNome} | Status: ${matricula.status}`);
      console.log(`  - Active Subscription: ${matricula.pagarme_subscription_id}`);
      console.log(`  - Total installments: ${installments.length} (${paidInstallments.length} paid, ${pendingInstallments.length} pending)`);
      console.log(`  - Will delete ${toDelete.length} pending installments:`);
      toDelete.forEach(d => {
        console.log(`    * [ID: ${d.id}] Due: ${d.data_vencimento} | Value: R$ ${d.valor}`);
        deleteIds.push(d.id);
      });
      totalDeleted += toDelete.length;
    }
  }

  console.log(`\nTotal pending installments to delete: ${totalDeleted}`);

  if (totalDeleted > 0 && !isDryRun) {
    console.log("Executing deletion in chunks of 100...");
    const chunkSize = 100;
    for (let i = 0; i < deleteIds.length; i += chunkSize) {
      const chunk = deleteIds.slice(i, i + chunkSize);
      const { error: delError } = await supabase
        .from('pagamentos')
        .delete()
        .in('id', chunk);

      if (delError) {
        console.error("Error executing chunk deletion:", delError);
      } else {
        console.log(`Deleted chunk ${i / chunkSize + 1} (${chunk.length} items)`);
      }
    }
    console.log("Deletion complete!");
  } else if (totalDeleted > 0) {
    console.log("This was a DRY RUN. Run with '--execute' to perform the actual deletion.");
  } else {
    console.log("No pending installments to delete.");
  }
}

run().catch(console.error);
