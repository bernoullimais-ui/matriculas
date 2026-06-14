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
  console.log("=== DELETING PENDING PAYMENTS FOR CANCELED MATRICULAS ===");

  // Fetch pending credit card payments where the associated matricula is cancelado
  const { data: payments, error } = await supabase
    .from('pagamentos')
    .select(`
      id,
      status,
      data_vencimento,
      valor,
      metodo_pagamento,
      matricula_id,
      matriculas (
        id,
        status,
        alunos (
          nome_completo
        )
      )
    `)
    .eq('status', 'pendente')
    .eq('metodo_pagamento', 'cartao_credito');

  if (error) {
    console.error("Error fetching payments:", error);
    return;
  }

  const toDelete = payments.filter(p => (p.matriculas as any)?.status === 'cancelado');

  console.log(`Found ${toDelete.length} pending credit card payments for canceled matriculas.`);

  if (toDelete.length === 0) {
    console.log("No payments to delete.");
    return;
  }

  const idsToDelete = toDelete.map(p => p.id);

  const { error: delError } = await supabase
    .from('pagamentos')
    .delete()
    .in('id', idsToDelete);

  if (delError) {
    console.error("Error deleting payments:", delError);
  } else {
    console.log(`Successfully deleted ${toDelete.length} pending payments for canceled matriculas.`);
    toDelete.forEach(p => {
      const alunoNome = (p.matriculas as any)?.alunos?.nome_completo || 'Unknown';
      console.log(`- Deleted ID: ${p.id} | Due: ${p.data_vencimento} | Aluno: ${alunoNome}`);
    });
  }
}

run().catch(console.error);
