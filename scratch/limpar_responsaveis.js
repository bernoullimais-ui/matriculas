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

function cleanCpf(cpf) {
  if (!cpf) return null;
  if (cpf.startsWith('IMP')) return null;
  const digits = cpf.replace(/\D/g, '');
  return digits.length === 11 ? digits : null;
}

function scoreRecord(r) {
  let score = 0;
  if (r.senha) score += 1000; 
  if (cleanCpf(r.cpf)) score += 100; 
  if (r.telefone) score += 10;
  return score;
}

async function run() {
  console.log(`Starting migration script. Mode: ${DRY_RUN ? 'DRY RUN' : 'EXECUTE'}`);
  
  const responsaveis = await fetchAll('responsaveis');
  const alunos = await fetchAll('alunos');
  
  const groupsByEmail = {};
  for (const r of responsaveis) {
    if (!r.email) continue;
    const email = r.email.toLowerCase().trim();
    if (!groupsByEmail[email]) groupsByEmail[email] = [];
    groupsByEmail[email].push(r);
  }

  const groupsByCpf = {};
  for (const r of responsaveis) {
    const cpf = cleanCpf(r.cpf);
    if (!cpf) continue;
    if (!groupsByCpf[cpf]) groupsByCpf[cpf] = [];
    groupsByCpf[cpf].push(r);
  }

  const recordToGroupId = {};
  const finalGroups = {};
  let nextGroupId = 1;

  function addToGroup(record, groupId) {
    if (recordToGroupId[record.id] === groupId) return;
    if (recordToGroupId[record.id]) {
      const oldGroupId = recordToGroupId[record.id];
      if (oldGroupId === groupId) return;
      for (const oldRec of finalGroups[oldGroupId]) {
        recordToGroupId[oldRec.id] = groupId;
        finalGroups[groupId].push(oldRec);
      }
      delete finalGroups[oldGroupId];
      return;
    }
    recordToGroupId[record.id] = groupId;
    if (!finalGroups[groupId]) finalGroups[groupId] = [];
    finalGroups[groupId].push(record);
  }

  for (const group of Object.values(groupsByEmail)) {
    if (group.length > 1) {
      const gId = nextGroupId++;
      finalGroups[gId] = [];
      for (const r of group) addToGroup(r, gId);
    }
  }

  for (const group of Object.values(groupsByCpf)) {
    if (group.length > 1) {
      let existingGId = null;
      for (const r of group) {
        if (recordToGroupId[r.id]) {
          existingGId = recordToGroupId[r.id];
          break;
        }
      }
      const gId = existingGId || nextGroupId++;
      if (!finalGroups[gId]) finalGroups[gId] = [];
      for (const r of group) addToGroup(r, gId);
    }
  }

  const groupsToProcess = Object.values(finalGroups).filter(g => g.length > 1);
  console.log(`Found ${groupsToProcess.length} disjoint groups to merge.`);

  let totalUpdated = {};
  let totalDeleted = 0;

  for (const group of groupsToProcess) {
    const scored = group.map(r => ({
      record: r,
      score: scoreRecord(r) + alunos.filter(a => a.responsavel_id === r.id).length
    }));

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(a.record.created_at) - new Date(b.record.created_at);
    });

    const primary = scored[0].record;
    const secondaries = scored.slice(1).map(s => s.record);

    console.log(`\n--- Merging Group (${group.length} records) ---`);
    console.log(`PRIMARY: ${primary.id} | ${primary.nome_completo} | ${primary.email} | ${primary.cpf} | Score: ${scored[0].score}`);
    
    for (const sec of secondaries) {
      console.log(`  SECONDARY -> ${sec.id} | ${sec.nome_completo} | ${sec.email} | ${sec.cpf}`);
      
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
        }
      }

      if (!DRY_RUN) {
        const { error } = await supabase.from('responsaveis').delete().eq('id', sec.id);
        if (error) console.error(`Error deleting responsavel ${sec.id}:`, error.message);
        else {
          console.log(`    Deleted responsavel ${sec.id}`);
          totalDeleted++;
        }
      }
    }
  }

  console.log(`\n=== Migration Summary ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'EXECUTED'}`);
  console.log(`Records to delete: ${totalDeleted}`);
  console.log(`Foreign keys to update:`, totalUpdated);
}

run().catch(console.error);
