require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkCounts() {
  const { data: matriculas } = await supabase.from('matriculas')
    .select('id, aluno_id, turma, unidade, status, data_cancelamento, data_matricula, plano')
    .order('created_at', { ascending: false })
    .limit(10000);

  const { data: alunos } = await supabase.from('alunos')
    .select('id, nome_completo, serie_ano, responsavel_id, data_nascimento')
    .order('created_at', { ascending: false })
    .limit(10000);

  const { data: responsaveis } = await supabase.from('responsaveis')
    .select('id, nome_completo, email, telefone, cpf')
    .order('created_at', { ascending: false })
    .limit(10000);

  // Replicate logic
  const result = (responsaveis || []).map(r => {
    const rAlunos = (alunos || [])
      .filter(a => String(a.responsavel_id).trim() === String(r.id).trim())
      .map(a => ({
        ...a,
        matriculas: (matriculas || []).filter(m => String(m.aluno_id).trim() === String(a.id).trim())
      }));
    return { ...r, alunos: rAlunos };
  });

  // App.tsx logic
  let matriculasAtivasCount = 0;
  let alunosAtivosSet = new Set();
  let dependents = [];

  result.forEach(resp => {
    (resp.alunos || []).forEach(aluno => {
      if (aluno.matriculas && aluno.matriculas.length > 0) {
        aluno.matriculas.forEach(mat => {
          dependents.push({
            id: aluno.id,
            nome_completo: aluno.nome_completo,
            data_nascimento: aluno.data_nascimento,
            turma: mat.turma,
            data_cancelamento: mat.data_cancelamento,
            status: mat.status
          });
        });
      } else {
        dependents.push({
          id: aluno.id,
          nome_completo: aluno.nome_completo,
          data_nascimento: aluno.data_nascimento
        });
      }
    });
  });

  let groups = {};
  dependents.forEach(dep => {
    const key = `${dep.nome_completo}-${dep.data_nascimento}`;
    if (!groups[key]) {
      groups[key] = {
        ...dep,
        matriculasAtivas: [],
        historico: []
      };
    }
    if (dep.turma) {
      if (dep.data_cancelamento) {
        groups[key].historico.push(dep);
      } else {
        groups[key].matriculasAtivas.push(dep);
      }
    }
  });

  const finalDependents = Object.values(groups);
  
  matriculasAtivasCount = finalDependents.reduce((acc, dep) => acc + dep.matriculasAtivas.length, 0);

  console.log('App.tsx Matrículas Ativas:', matriculasAtivasCount);
  
  // What about Alunos Ativos? In old dashboard, it's 408
  // Let's test the 408 value
  console.log('Alunos Ativos (status in ativo/Ativo from limit 10000):', new Set(matriculas.filter(m => ['ativo', 'Ativo'].includes(m.status)).map(m=>m.aluno_id)).size);

}

checkCounts().catch(console.error);
