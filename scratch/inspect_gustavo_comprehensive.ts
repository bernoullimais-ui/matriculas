import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  // Find aluno Gustavo
  const { data: students, error: errStudent } = await supabase
    .from('alunos')
    .select('id, nome_completo, responsavel_id')
    .ilike('nome_completo', '%Gustavo%Cardoso%');

  if (errStudent) {
    console.error('Error finding student:', errStudent);
    return;
  }

  console.log('Students found:', students);

  const studentIds = students?.map(s => s.id) || [];
  const responsavelIds = students?.map(s => s.responsavel_id).filter(Boolean) || [];

  // Query responsaveis
  if (responsavelIds.length > 0) {
    const { data: responsaveis } = await supabase
      .from('responsaveis')
      .select('*')
      .in('id', responsavelIds);
    console.log('Responsaveis found:', responsaveis);
  }

  // Find payments by student ID
  if (studentIds.length > 0) {
    const { data: paymentsByStudent, error: errPayments } = await supabase
      .from('pagamentos_wix')
      .select('*')
      .in('aluno_id', studentIds);
    
    if (errPayments) {
      console.error('Error finding payments by student:', errPayments);
    } else {
      console.log('--- Payments by Student ID ---');
      paymentsByStudent.forEach((p: any) => {
        console.log({
          id: p.id,
          data_pagamento: p.data_pagamento_gmt_03,
          id_provedor_pagamento: p.id_provedor_pagamento,
          valor: p.valor,
          status: p.status_transacao,
          provedor: p.provedor_pagamento,
          email: p.cobranca_email,
          aluno_id: p.aluno_id,
          created_at: p.created_at
        });
      });
    }
  }

  // Also query payments where student name is mentioned or email is used
  const { data: paymentsByEmail } = await supabase
    .from('pagamentos_wix')
    .select('*')
    .ilike('cobranca_email', 'heisinha1@gmail.com');

  console.log('--- Payments by Email ---');
  paymentsByEmail?.forEach((p: any) => {
    console.log({
      id: p.id,
      data_pagamento: p.data_pagamento_gmt_03,
      id_provedor_pagamento: p.id_provedor_pagamento,
      valor: p.valor,
      status: p.status_transacao,
      provedor: p.provedor_pagamento,
      email: p.cobranca_email,
      aluno_id: p.aluno_id,
      created_at: p.created_at
    });
  });
}
run();
