require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const fetchAllFromSupabase = async (table, selectFields = '*') => {
  let allData = [];
  let page = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase
      .from(table)
      .select(selectFields)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error) {
      throw error;
    }
    allData = [...allData, ...(data || [])];
    if (!data || data.length < 1000) {
      hasMore = false;
    } else {
      page++;
    }
  }
  return allData;
};

async function checkCounts() {
  const allMat = await fetchAllFromSupabase('matriculas', 'id, aluno_id, status, data_cancelamento');
  
  const inData = allMat.filter(m => ['ativo', 'Ativo'].includes(m.status));
  
  // App.tsx method: no data_cancelamento and status not cancelado/transferido?
  // Let's test a few combinations
  
  const c1 = allMat.filter(m => !m.data_cancelamento && m.status !== 'cancelado' && m.status !== 'transferido');
  const c2 = allMat.filter(m => !m.data_cancelamento && m.status !== 'transferido');
  const c3 = allMat.filter(m => !m.data_cancelamento);
  const c4 = allMat.filter(m => ['ativo', 'Ativo'].includes(m.status));
  const c5 = allMat.filter(m => ['ativo', 'Ativo', 'pendente', 'Pendente'].includes(m.status) && !m.data_cancelamento);
  
  console.log('c1 (not cancelado/transferido, !data_cancelamento):', c1.length, '| alunos:', new Set(c1.map(m=>m.aluno_id)).size);
  console.log('c2 (!data_cancelamento, not transferido):', c2.length, '| alunos:', new Set(c2.map(m=>m.aluno_id)).size);
  console.log('c3 (!data_cancelamento):', c3.length, '| alunos:', new Set(c3.map(m=>m.aluno_id)).size);
  console.log('c4 (ativo/Ativo):', c4.length, '| alunos:', new Set(c4.map(m=>m.aluno_id)).size);
  console.log('c5 (ativo/Ativo/pendente, !data_cancelamento):', c5.length, '| alunos:', new Set(c5.map(m=>m.aluno_id)).size);

}

checkCounts().catch(console.error);
