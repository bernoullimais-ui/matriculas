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
  
  const ativos = allMat.filter(m => ['ativo', 'Ativo'].includes(m.status));
  const ativosSemCancelamento = ativos.filter(m => !m.data_cancelamento);
  
  console.log('ativos alunos:', new Set(ativos.map(m => m.aluno_id)).size);
  console.log('ativosSemCancelamento alunos:', new Set(ativosSemCancelamento.map(m => m.aluno_id)).size);
}

checkCounts().catch(console.error);
