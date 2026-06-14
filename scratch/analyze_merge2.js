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
  
  const groupedByNamePhone = {};
  for (const r of responsaveis) {
    if (!r.nome_completo) continue;
    const nome = r.nome_completo.toLowerCase().trim();
    // Normalize phone by removing non-digits
    let telefone = r.telefone ? r.telefone.replace(/\D/g, '') : 'null';
    if (telefone.length === 0) telefone = 'null';
    
    // Some don't have phone, in that case just name? Let's require at least a phone or email match, or just name match if it's identical and long enough?
    // Actually, if they have identical name and are imported, they are probably the same person.
    // Let's just group by exact name lowercase.
    const key = nome;
    if (!groupedByNamePhone[key]) groupedByNamePhone[key] = [];
    groupedByNamePhone[key].push(r);
  }

  let totalMergeable = 0;
  for (const [key, group] of Object.entries(groupedByNamePhone)) {
    if (group.length > 1) {
      totalMergeable++;
    }
  }

  console.log(`Mergeable by Exact Name: ${totalMergeable} groups`);
  
  // Let's look at the "Alexandre Ramos Ribeiro" group or "Adriana Caldas Bezerra Leite"
  for (const [key, group] of Object.entries(groupedByNamePhone)) {
    if (group.length > 1 && (key.includes('alexandre ramos') || key.includes('adriana caldas'))) {
      console.log(`\n--- Group: ${key} ---`);
      for (const r of group) {
        const dependents = alunos.filter(a => a.responsavel_id === r.id);
        console.log(`ID: ${r.id} | Email: ${r.email} | CPF: ${r.cpf} | Phone: ${r.telefone} | Senha: ${!!r.senha} | Dep: ${dependents.length}`);
      }
    }
  }
}
run();
