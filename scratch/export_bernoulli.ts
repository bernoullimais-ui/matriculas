import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function exportCSV() {
  // Pegar matrículas ativas da unidade Bernoulli
  const { data: matriculas, error: matErr } = await supabase
    .from('matriculas')
    .select('*')
    .ilike('unidade', '%Bernoulli%')
    .ilike('status', 'ativo');

  if (matErr || !matriculas) {
    console.error('Erro buscando matrículas:', matErr);
    return;
  }

  const alunoIds = matriculas.map(m => m.aluno_id).filter(id => id);
  const turmaIds = matriculas.map(m => m.turma_id).filter(id => id);

  const { data: alunos } = await supabase
    .from('alunos')
    .select('*')
    .in('id', alunoIds);

  const { data: turmas } = await supabase
    .from('turmas')
    .select('*')
    .in('id', turmaIds);

  const alunosMap = new Map((alunos || []).map(a => [a.id, a]));
  const turmasMap = new Map((turmas || []).map(t => [t.id, t]));

  console.log(`Encontradas ${matriculas.length} matrículas ativas.`);

  const headers = ['Nome do Aluno', 'Série', 'Turma Escolar', 'Turma do Esporte', 'Dias e Horários'];
  const csvRows = [headers.join(',')];

  matriculas.sort((a, b) => {
    const nomeA = alunosMap.get(a.aluno_id)?.nome_completo || '';
    const nomeB = alunosMap.get(b.aluno_id)?.nome_completo || '';
    return nomeA.localeCompare(nomeB);
  });

  matriculas.forEach(mat => {
    const aluno = alunosMap.get(mat.aluno_id) || {} as any;
    const turmaRef = turmasMap.get(mat.turma_id) || {} as any;
    
    const nome = `"${aluno.nome_completo || ''}"`;
    const serie = `"${aluno.serie_ano || ''}"`;
    const turmaEscolar = `"${aluno.turma_escolar || ''}"`;
    const turmaEsporte = `"${mat.turma || turmaRef.nome || ''}"`;
    const dias = `"${turmaRef.dias_horarios || ''}"`;

    csvRows.push([nome, serie, turmaEscolar, turmaEsporte, dias].join(','));
  });

  const outputPath = '/Users/brunomaia/.gemini/antigravity/brain/09e5eb60-aed0-419e-b4ec-6fe921f6088a/Alunos_Bernoulli.csv';
  fs.writeFileSync(outputPath, csvRows.join('\n'), 'utf-8');
  console.log('CSV salvo em:', outputPath);
}

exportCSV();
