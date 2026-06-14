import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

async function run() {
  const { data: wixPayments, error: errWix } = await supabase
    .from('pagamentos_wix')
    .select('*')
    .eq('cobranca_email', 'ahrs76@hotmail.com');
  if (errWix) {
    console.error("Error fetching wix payments:", errWix);
    return;
  }
  
  console.log(`Total payments found: ${wixPayments.length}`);
  
  // Group by student and product
  const summary: any = {};
  for (const p of wixPayments) {
    const key = `${p.aluno_id || 'unassigned'} | ${p.produto_nome}`;
    if (!summary[key]) {
      summary[key] = {
        aluno_id: p.aluno_id,
        produto: p.produto_nome,
        count: 0,
        payments: []
      };
    }
    summary[key].count++;
    summary[key].payments.push({
      id: p.id_provedor_pagamento,
      status: p.status_transacao,
      aluno_id: p.aluno_id
    });
  }
  
  for (const [key, value] of Object.entries(summary)) {
    const val = value as any;
    // Resolve student name
    let name = 'Unknown';
    if (val.aluno_id === '6aa85f77-55b8-4be8-a44d-cbbae5559aa6') name = 'Amanda Salles Sampaio';
    else if (val.aluno_id === '42bd46aa-d412-4fce-8520-c615141d9426') name = 'Henrique Salles Sampaio';
    
    console.log(`Student: ${name} (ID: ${val.aluno_id}) | Product: ${val.produto} | Count: ${val.count}`);
  }
}

run();
