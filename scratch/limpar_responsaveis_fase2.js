import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = process.argv.includes('--run') ? false : true;

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

function cleanPhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

async function run() {
  console.log(`Starting migration script FASE 2. Mode: ${DRY_RUN ? 'DRY RUN' : 'EXECUTE'}`);
  
  const responsaveis = await fetchAll('responsaveis');
  const alunos = await fetchAll('alunos');
  
  const groupsByNamePhone = {};
  
  for (const r of responsaveis) {
    if (!r.nome_completo) continue;
    const nome = r.nome_completo.toLowerCase().trim();
    // Exclude simple names like "Responsável Importado" or very short names
    if (nome === 'responsável importado' || nome === 'responsavel importado' || nome.length < 4) continue;
    
    const phone = cleanPhone(r.telefone);
    // If no phone, maybe just use name? Yes, exact name match is usually safe if it's a full name.
    // Let's use name + phone if phone exists, else just name.
    const key = phone ? `${nome}_${phone}` : `${nome}_nophone`;
    
    if (!groupsByNamePhone[key]) groupsByNamePhone[key] = [];
    groupsByNamePhone[key].push(r);
  }

  const groupsToProcess = Object.values(groupsByNamePhone).filter(g => g.length > 1);
  console.log(`Found ${groupsToProcess.length} disjoint groups to merge.`);

  let totalUpdated = {};
  let totalDeleted = 0;

  for (const group of groupsToProcess) {
    // Score each record to pick primary
    // Primary should be the one with the most dependents, then most recent login/password
    const scored = group.map(r => {
      const deps = alunos.filter(a => a.responsavel_id === r.id);
      let score = deps.length * 10000; // Dependents is the highest priority! We don't want to break existing active accounts.
      if (r.senha && r.senha !== '123456') score += 1000; // Has real password
      if (r.senha === '123456') score += 500; // Has dummy password
      if (r.email) score += 100;
      if (r.cpf && !r.cpf.startsWith('IMP')) score += 10;
      return { record: r, score };
    });

    // Sort descending by score, then ascending by created_at
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(a.record.created_at) - new Date(b.record.created_at);
    });

    const primary = scored[0].record;
    const secondaries = scored.slice(1).map(s => s.record);

    console.log(`\n--- Merging Group (${group.length} records) ---`);
    console.log(`PRIMARY: ${primary.id} | ${primary.nome_completo} | ${primary.email} | ${primary.cpf} | Phone: ${primary.telefone} | Score: ${scored[0].score}`);
    
    for (const sec of secondaries) {
      console.log(`  SECONDARY -> ${sec.id} | ${sec.nome_completo} | ${sec.email} | ${sec.cpf} | Phone: ${sec.telefone}`);
      
      const tables = ['alunos', 'pagamentos', 'pagamentos_wix', 'evento_inscricoes', 'cupom_usos', 'loja_pedidos', 'avaliacoes', 'frequencias', 'admin_logs', 'mensagens'];
      for (const table of tables) {
        if (!totalUpdated[table]) totalUpdated[table] = 0;
        if (!DRY_RUN) {
          const { data, error } = await supabase.from(table).update({ responsavel_id: primary.id }).eq('responsavel_id', sec.id).select('id');
          if (error && !error.message.includes("relation") && !error.message.includes("does not exist")) {
             console.error(`Error updating ${table}:`, error.message);
          } else if (data && data.length > 0) {
            console.log(`    Updated ${data.length} row(s) in ${table}`);
            totalUpdated[table] += data.length;
          }
        } else {
           const { data, error } = await supabase.from(table).select('id').eq('responsavel_id', sec.id);
           if (data && data.length > 0) {
              console.log(`    [DRY RUN] Would update ${data.length} row(s) in ${table}`);
              totalUpdated[table] += data.length;
           }
        }
      }

      if (!DRY_RUN) {
        const { error } = await supabase.from('responsaveis').delete().eq('id', sec.id);
        if (error) console.error(`Error deleting responsavel ${sec.id}:`, error.message);
        else {
          console.log(`    Deleted responsavel ${sec.id}`);
          totalDeleted++;
        }
      } else {
        console.log(`    [DRY RUN] Would delete responsavel ${sec.id}`);
        totalDeleted++;
      }
    }
  }

  console.log(`\n=== Migration Summary ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'EXECUTED'}`);
  console.log(`Records to delete: ${totalDeleted}`);
  console.log(`Foreign keys to update:`, totalUpdated);
}

run().catch(console.error);
