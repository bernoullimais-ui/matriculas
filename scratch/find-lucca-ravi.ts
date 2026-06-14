import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function search() {
  console.log("=== SEARCHING FOR LUCCA AND RAVI ===");
  
  // Search in responsaveis
  const { data: resps, error: rErr } = await supabase
    .from('responsaveis')
    .select('*')
    .or('nome_completo.ilike.%Mariana Peters%,nome_completo.ilike.%Ravi%,nome_completo.ilike.%Lucca%,email.ilike.%mariana.peters%,email.ilike.%rafinha_neves%');

  console.log("Responsaveis found:", resps?.length);
  resps?.forEach(r => console.log(`- ID: ${r.id}, Name: ${r.nome_completo}, Email: ${r.email}`));

  // Search in alunos
  const { data: als, error: aErr } = await supabase
    .from('alunos')
    .select('*')
    .or('nome_completo.ilike.%Lucca%,nome_completo.ilike.%Ravi%');

  console.log("\nAlunos found:", als?.length);
  als?.forEach(a => console.log(`- ID: ${a.id}, Name: ${a.nome_completo}, RespID: ${a.responsavel_id}`));

  // Search in pagamentos
  const { data: pags, error: pErr } = await supabase
    .from('pagamentos')
    .select('*')
    .limit(1000);
  
  const filteredPags = pags?.filter(p => {
    const resp = resps?.find(r => r.id === p.responsavel_id);
    return !!resp;
  });
  console.log("\nStandard payments found for these guardians:", filteredPags?.length);
  filteredPags?.forEach(p => console.log(`- ID: ${p.id}, Value: ${p.valor}, Status: ${p.status}, Date: ${p.data_vencimento || p.created_at}`));

  // Search in pagamentos_wix
  // Let's search all rows by doing pagination or direct query
  const { data: wixPags, error: wErr } = await supabase
    .from('pagamentos_wix')
    .select('*')
    .or(`responsavel_id.in.(${resps?.map(r => r.id).join(',') || '""'}),aluno_id.in.(${als?.map(a => a.id).join(',') || '""'})`);

  console.log("\nWix payments found for these guardians/students:", wixPags?.length);
  wixPags?.forEach(w => console.log(`- ID: ${w.id}, Value: ${w.valor}, Status: ${w.status_transacao}, Date: ${w.data_pagamento_gmt_03 || w.created_at}`));
}

search();
