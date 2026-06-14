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
  
  // Group by name/email/cpf to find duplicates
  const grouped = {};
  for (const r of responsaveis) {
    const key = (r.email || r.cpf || r.nome_completo || 'unknown').toLowerCase().trim();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }
  
  const duplicates = Object.entries(grouped).filter(([k, v]) => v.length > 1);
  console.log(`Total responsaveis: ${responsaveis.length}`);
  console.log(`Found ${duplicates.length} groups of duplicates.`);
  
  // Look at the first 3 groups
  for (const [k, v] of duplicates.slice(0, 3)) {
    console.log(`\nGroup: ${k}`);
    for (const r of v) {
      console.log(`  - ${r.id} | ${r.nome_completo} | ${r.email} | ${r.cpf} | ${r.created_at}`);
    }
  }
}
run();
