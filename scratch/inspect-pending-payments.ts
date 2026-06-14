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
  console.log("=== INSPECTING PENDING CREDIT CARD PAYMENTS ===");

  // Query all pagamentos where status = 'pendente' and metodo_pagamento = 'cartao_credito'
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
        pagarme_subscription_id,
        alunos (
          nome_completo
        )
      )
    `)
    .eq('status', 'pendente')
    .eq('metodo_pagamento', 'cartao_credito')
    .order('data_vencimento', { ascending: true });

  if (error) {
    console.error("Error fetching pending payments:", error);
    return;
  }

  console.log(`Found ${payments.length} pending credit card payments in total.`);

  for (const p of payments) {
    const matricula = p.matriculas as any;
    const alunoNome = matricula?.alunos?.nome_completo || 'Unknown Aluno';
    console.log(`Payment ID: ${p.id} | Due: ${p.data_vencimento} | Value: R$ ${p.valor}`);
    console.log(`  - Matricula ID: ${p.matricula_id} | Status: ${matricula?.status} | Sub ID: ${matricula?.pagarme_subscription_id}`);
    console.log(`  - Aluno: ${alunoNome}`);
  }
}

run().catch(console.error);
