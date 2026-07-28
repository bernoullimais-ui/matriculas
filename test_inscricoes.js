require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase
    .from('evento_inscricoes')
    .select('*, eventos(*)')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const alunosIds = Array.from(new Set(data?.map(i => i.aluno_id).filter(Boolean)));
  console.log("Found", alunosIds.length, "aluno_ids");
  
  let alunosData = [];
  if (alunosIds.length > 0) {
    const { data: aData, error: aErr } = await supabase
      .from('alunos')
      .select('id, data_nascimento, unidade')
      .in('id', alunosIds);
    if (aErr) console.error("Error fetching alunos", aErr);
    if (aData) alunosData = aData;
  }

  console.log("Fetched", alunosData.length, "alunos");

  const alunosMap = new Map();
  alunosData.forEach(a => alunosMap.set(a.id, a));

  const mappedData = data?.map(inscricao => {
    if (inscricao.aluno_id) {
      const aluno = alunosMap.get(inscricao.aluno_id);
      if (aluno) {
        inscricao.alunos = aluno;
      }
    }
    return inscricao;
  });

  const ravi = mappedData.find(i => i.nome_aluno && i.nome_aluno.includes('Ravi Nogueira'));
  console.log("Ravi's data:", ravi.alunos);
}
run();
