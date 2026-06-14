import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

async function run() {
  console.log("Starting sibling payment database correction...");

  // 1. Correct Xadrez 2 payments under ahrs76@hotmail.com to Henrique (42bd46aa-d412-4fce-8520-c615141d9426)
  const henriqueId = '42bd46aa-d412-4fce-8520-c615141d9426';
  
  // Find Henrique's Xadrez 2 matricula to update matricula_id and turma_id as well
  const { data: mats } = await supabase
    .from('matriculas')
    .select('id, turma_id')
    .eq('aluno_id', henriqueId)
    .ilike('plano', '%Xadrez%');
  
  const henriqueXadrezMat = mats && mats.length > 0 ? mats[0] : null;
  console.log("Henrique's Xadrez 2 Matricula:", henriqueXadrezMat);

  const { data: affected, error: selectErr } = await supabase
    .from('pagamentos_wix')
    .select('id, id_provedor_pagamento, aluno_id, produto_nome')
    .eq('cobranca_email', 'ahrs76@hotmail.com')
    .eq('produto_nome', 'Xadrez 2');

  if (selectErr) {
    console.error("Error finding Xadrez 2 payments:", selectErr);
    return;
  }

  console.log(`Found ${affected?.length || 0} payments of Xadrez 2 under ahrs76@hotmail.com.`);

  let updatedCount = 0;
  if (affected) {
    for (const p of affected) {
      if (p.aluno_id !== henriqueId) {
        console.log(`Correcting payment ${p.id_provedor_pagamento}: current aluno_id = ${p.aluno_id} -> changing to ${henriqueId}`);
        const updateData: any = { aluno_id: henriqueId };
        if (henriqueXadrezMat) {
          updateData.matricula_id = henriqueXadrezMat.id;
          updateData.turma_id = henriqueXadrezMat.turma_id;
        }
        const { error: updateErr } = await supabase
          .from('pagamentos_wix')
          .update(updateData)
          .eq('id', p.id);
        
        if (updateErr) {
          console.error(`Failed to update payment ${p.id_provedor_pagamento}:`, updateErr);
        } else {
          updatedCount++;
        }
      }
    }
  }

  console.log(`Database correction completed. Updated ${updatedCount} payments.`);
}

run();
