import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const students = [
    "FRANCISCO BANDEIRA OLIVEIRA D'ANUNCIAÇÃO",
    "MARIA AMÉLIA MURICY REIS",
    "LUÍSA MENDES ORGE",
    "PIETRA MARINHO BACELLAR COELHO"
  ];
  
  // Find aluno IDs for these names
  const { data: alunos, error: aErr } = await supabase
    .from('alunos')
    .select('id, nome')
    .ilike('nome', `%FRANCISCO BANDEIRA%`);
    
  console.log('Francisco Alunos:', alunos);

  const { data: allAlunos, error: allErr } = await supabase
    .from('alunos')
    .select('*');
    
  if (allErr) {
    console.error(allErr);
    return;
  }

  const matches = allAlunos.filter(a => {
    const nome = a.nome_completo || a.nome || '';
    return students.some(s => nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(' ')[0]
    ));
  });

  console.log('Matched Aluno IDs:', matches.map(m => ({ id: m.id, nome: m.nome_completo || m.nome })));

  const matchedIds = matches.map(m => m.id);
  if (matchedIds.length > 0) {
    const { data: pagamentos, error: pErr } = await supabase
      .from('pagamentos')
      .select('id, aluno_id, valor, metodo_pagamento, status, pagarme, created_at')
      .in('aluno_id', matchedIds);

    console.log('Payments for these students:');
    console.log(JSON.stringify(pagamentos, null, 2));

    // Also let's print their student names with their payments
    if (pagamentos) {
      for (const p of pagamentos) {
        const student = matches.find(m => m.id === p.aluno_id);
        const sName = student ? (student.nome_completo || student.nome) : '';
        console.log(`Payment: ${p.id} | Student: ${sName} | Pagarme: ${p.pagarme} | Metodo: ${p.metodo_pagamento} | Status: ${p.status} | Created: ${p.created_at}`);
      }
    }
  }
}

run();
