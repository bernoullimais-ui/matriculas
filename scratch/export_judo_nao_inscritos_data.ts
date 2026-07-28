import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
}

async function exportAlunosNaoInscritos() {
  console.log("Iniciando exportação...");
  
  const eventoId = '68869eca-83ce-4294-bcdc-741b33800db5'; // Exame de Faixas

  // Buscar alunos inscritos no evento
  const { data: inscricoes, error: inscErr } = await supabase
    .from('evento_inscricoes')
    .select('aluno_id, status')
    .eq('evento_id', eventoId);

  if (inscErr) {
    console.error('Erro ao buscar inscrições:', inscErr);
    return;
  }

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

  // Buscar os nomes e dados dos alunos
  const { data: alunos, error: alunosErr } = await supabase
    .from('alunos')
    .select('id, nome_completo, data_nascimento')
    .in('id', alunosMatriculadosIds);

  if (alunosErr) {
    console.error('Erro ao buscar alunos:', alunosErr);
    return;
  }

  const alunosMap = new Map(alunos.map(a => [a.id, a]));

  // Filtrar os que NÃO estão inscritos
  const result = [];
  
  for (const m of matriculas) {
    if (!alunosInscritosIds.has(m.aluno_id)) {
      const aluno = alunosMap.get(m.aluno_id);
      const alunoNome = aluno ? aluno.nome_completo : 'Desconhecido';
      const dataNascimento = aluno ? aluno.data_nascimento : '';
      
      result.push({
        alunoNome,
        unidade: m.unidade,
        dataNascimento: formatDate(dataNascimento)
      });
    }
  }

  // Remover possíveis duplicatas
  const uniqueResultMap = new Map();
  for (const item of result) {
    const key = `${item.alunoNome}-${item.unidade}`;
    if (!uniqueResultMap.has(key)) {
      uniqueResultMap.set(key, item);
    }
  }

  const uniqueResult = Array.from(uniqueResultMap.values());

  uniqueResult.sort((a, b) => {
    if (a.unidade !== b.unidade) return (a.unidade || '').localeCompare(b.unidade || '');
    return a.alunoNome.localeCompare(b.alunoNome);
  });

  const headers = ['Nome do Aluno', 'Unidade', 'Data de Nascimento'];
  const csvRows = [headers.join(',')];

  uniqueResult.forEach(row => {
    csvRows.push([
      `"${row.alunoNome}"`,
      `"${row.unidade || ''}"`,
      `"${row.dataNascimento || ''}"`
    ].join(','));
  });

  const outputPath = '/Users/brunomaia/.gemini/antigravity/brain/09e5eb60-aed0-419e-b4ec-6fe921f6088a/Alunos_Judo_Nao_Inscritos_Data_Nascimento.csv';
  fs.writeFileSync(outputPath, csvRows.join('\n'), 'utf-8');
  console.log(`Exportação concluída. ${uniqueResult.length} alunos salvos em ${outputPath}`);
}

exportAlunosNaoInscritos();
