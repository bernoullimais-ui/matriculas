import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fetchAll(table) {
  let all = [];
  let hasMore = true;
  let from = 0;
  while (hasMore) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + 999);
    if (error) throw error;
    all = all.concat(data);
    if (data.length < 1000) hasMore = false;
    from += 1000;
  }
  return all;
}

async function run() {
  const responsaveis = await fetchAll('responsaveis');
  const alunos = await fetchAll('alunos');
  
  // Group responsaveis by lowercase email where email exists
  const groupedByEmail = {};
  for (const r of responsaveis) {
    if (!r.email) continue;
    const email = r.email.toLowerCase().trim();
    if (!groupedByEmail[email]) groupedByEmail[email] = [];
    groupedByEmail[email].push(r);
  }
  
  // Group by CPF where CPF exists and doesn't start with IMP
  const groupedByCpf = {};
  for (const r of responsaveis) {
    if (!r.cpf || r.cpf.startsWith('IMP')) continue;
    const cpf = r.cpf.replace(/\D/g, '').trim();
    if (cpf.length !== 11) continue;
    if (!groupedByCpf[cpf]) groupedByCpf[cpf] = [];
    groupedByCpf[cpf].push(r);
  }

  let totalMergeableByEmail = 0;
  for (const [email, group] of Object.entries(groupedByEmail)) {
    if (group.length > 1) {
      totalMergeableByEmail++;
    }
  }

  let totalMergeableByCpf = 0;
  for (const [cpf, group] of Object.entries(groupedByCpf)) {
    if (group.length > 1) {
      totalMergeableByCpf++;
    }
  }

  console.log(`Mergeable by Email: ${totalMergeableByEmail} groups`);
  console.log(`Mergeable by CPF: ${totalMergeableByCpf} groups`);
  
  // Let's print out what a typical merge group looks like for email
  const sampleGroup = Object.values(groupedByEmail).find(g => g.length > 1 && g.some(r => r.cpf && r.cpf.startsWith('IMP')) && g.some(r => r.cpf && !r.cpf.startsWith('IMP')));
  
  if (sampleGroup) {
    console.log('\n--- Sample Merge Group (Email) ---');
    for (const r of sampleGroup) {
      const dependents = alunos.filter(a => a.responsavel_id === r.id);
      console.log(`ID: ${r.id}`);
      console.log(`Name: ${r.nome_completo}`);
      console.log(`Email: ${r.email}`);
      console.log(`CPF: ${r.cpf}`);
      console.log(`Has Password: ${!!r.senha}`);
      console.log(`Dependents: ${dependents.length} (${dependents.map(d => d.nome_completo).join(', ')})`);
      console.log('--------------------------------');
    }
  }
}
run();
