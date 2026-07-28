import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function exportAlunosNaoInscritos() {
  console.log("Iniciando exportação...");
  
  const eventoId = '68869eca-83ce-4294-bcdc-741b33800db5'; // Exame de Faixas

  // Buscar alunos inscritos no evento (considerando todos que não estão cancelados ou com status inválido)
  // Para garantir, vamos pegar todos com aluno_id
  const { data: inscricoes, error: inscErr } = await supabase
    .from('evento_inscricoes')
    .select('aluno_id, status')
    .eq('evento_id', eventoId);

  if (inscErr) {
    console.error('Erro ao buscar inscrições:', inscErr);
    return;
  }

  // Filtrar status cancelado caso haja. Se status nulo, considera inscrito.
  const alunosInscritosIds = new Set(
    inscricoes
      .filter(i => i.aluno_id && i.status?.toLowerCase() !== 'cancelado' && i.status?.toLowerCase() !== 'cancelled')
      .map(i => i.aluno_id)
  );

  console.log(`Total de alunos inscritos no evento: ${alunosInscritosIds.size}`);

  // Buscar todas as turmas de judô
  const { data: turmas, error: turmasErr } = await supabase
    .from('turmas')
    .select('id, nome, professor')
    .ilike('nome', '%jud%');
    
  if (turmasErr) {
    console.error('Erro ao buscar turmas:', turmasErr);
    return;
  }

  const turmaIds = turmas.map(t => t.id);
  const turmasMap = new Map(turmas.map(t => [t.id, t]));

  // Buscar matrículas ativas nessas turmas
  const { data: matriculas, error: matErr } = await supabase
    .from('matriculas')
    .select('aluno_id, unidade, turma_id, turma')
    .ilike('status', 'ativo')
    .in('turma_id', turmaIds);

  if (matErr) {
    console.error('Erro ao buscar matrículas:', matErr);
    return;
  }

  const alunosMatriculadosIds = [...new Set(matriculas.map(m => m.aluno_id))];

  // Buscar os nomes dos alunos
  const { data: alunos, error: alunosErr } = await supabase
    .from('alunos')
    .select('id, nome_completo')
    .in('id', alunosMatriculadosIds);

  if (alunosErr) {
    console.error('Erro ao buscar alunos:', alunosErr);
    return;
  }

  const alunosMap = new Map(alunos.map(a => [a.id, a.nome_completo]));

  // Filtrar os que NÃO estão inscritos
  const result = [];
  
  for (const m of matriculas) {
    if (!alunosInscritosIds.has(m.aluno_id)) {
      const alunoNome = alunosMap.get(m.aluno_id) || 'Desconhecido';
      const turmaObjeto = turmasMap.get(m.turma_id);
      const turmaNome = turmaObjeto ? turmaObjeto.nome : m.turma || '';
      
      result.push({
        alunoNome,
        unidade: m.unidade,
        turmaNome
      });
    }
  }

  // Remover possíveis duplicatas (mesmo aluno matriculado em duas turmas de judô)
  const uniqueResultMap = new Map();
  for (const item of result) {
    const key = `${item.alunoNome}-${item.unidade}`;
    if (!uniqueResultMap.has(key)) {
      uniqueResultMap.set(key, item);
    } else {
      // Se houver mais de uma turma, concatena
      const existing = uniqueResultMap.get(key);
      if (!existing.turmaNome.includes(item.turmaNome)) {
         existing.turmaNome += ` / ${item.turmaNome}`;
      }
    }
  }

  const uniqueResult = Array.from(uniqueResultMap.values());

  uniqueResult.sort((a, b) => {
    if (a.unidade !== b.unidade) return (a.unidade || '').localeCompare(b.unidade || '');
    return a.alunoNome.localeCompare(b.alunoNome);
  });

  const headers = ['Nome do Aluno', 'Unidade', 'Turma'];
  const csvRows = [headers.join(',')];

  uniqueResult.forEach(row => {
    csvRows.push([
      `"${row.alunoNome}"`,
      `"${row.unidade || ''}"`,
      `"${row.turmaNome || ''}"`
    ].join(','));
  });

  const outputPath = '/Users/brunomaia/.gemini/antigravity/brain/09e5eb60-aed0-419e-b4ec-6fe921f6088a/Alunos_Judo_Nao_Inscritos.csv';
  fs.writeFileSync(outputPath, csvRows.join('\n'), 'utf-8');
  console.log(`Exportação concluída. ${uniqueResult.length} alunos salvos em ${outputPath}`);
}

exportAlunosNaoInscritos();
