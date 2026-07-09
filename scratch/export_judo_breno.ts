import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function exportJudoBrenoCSV() {
  console.log("Consultando banco...");
  
  // Pegar matrículas ativas
  const { data: matriculas, error: matErr } = await supabase
    .from('matriculas')
    .select('id, aluno_id, turma_id, unidade, turma')
    .ilike('status', 'ativo');

  if (matErr || !matriculas) {
    console.error('Erro buscando matrículas:', matErr);
    return;
  }

  const alunoIds = [...new Set(matriculas.map(m => m.aluno_id).filter(id => id))];
  const turmaIds = [...new Set(matriculas.map(m => m.turma_id).filter(id => id))];

  // Buscar alunos
  const { data: alunos } = await supabase
    .from('alunos')
    .select('id, nome_completo')
    .in('id', alunoIds);

  // Buscar turmas
  const { data: turmas } = await supabase
    .from('turmas')
    .select('id, nome, professor')
    .in('id', turmaIds);

  const alunosMap = new Map((alunos || []).map(a => [a.id, a]));
  const turmasMap = new Map((turmas || []).map(t => [t.id, t]));

  // Filtrar apenas alunos de Judô do Breno
  const result = [];
  
  for (const mat of matriculas) {
    const turma = turmasMap.get(mat.turma_id);
    const aluno = alunosMap.get(mat.aluno_id);
    
    if (!turma || !aluno) continue;

    const professor = turma.professor || '';
    const nomeTurma = turma.nome || mat.turma || '';
    
    if (professor.toLowerCase().includes('breno') && (nomeTurma.toLowerCase().includes('jud') || mat.turma?.toLowerCase().includes('jud'))) {
      result.push({
        aluno_nome: aluno.nome_completo,
        unidade: mat.unidade,
        turma_nome: nomeTurma
      });
    }
  }

  console.log(`Encontrados ${result.length} alunos.`);

  const headers = ['Nome do Aluno', 'Unidade', 'Turma'];
  const csvRows = [headers.join(',')];

  result.sort((a, b) => {
    if (a.unidade !== b.unidade) return a.unidade.localeCompare(b.unidade);
    return a.aluno_nome.localeCompare(b.aluno_nome);
  });

  result.forEach(row => {
    const nome = `"${row.aluno_nome || ''}"`;
    const unidade = `"${row.unidade || ''}"`;
    const turmaStr = `"${row.turma_nome || ''}"`;

    csvRows.push([nome, unidade, turmaStr].join(','));
  });

  const outputPath = '/Users/brunomaia/.gemini/antigravity/brain/09e5eb60-aed0-419e-b4ec-6fe921f6088a/Alunos_Judo_Breno.csv';
  fs.writeFileSync(outputPath, csvRows.join('\n'), 'utf-8');
  console.log('CSV salvo em:', outputPath);
}

exportJudoBrenoCSV();
