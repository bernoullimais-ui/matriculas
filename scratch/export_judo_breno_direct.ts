import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function exportJudoBrenoCSV() {
  console.log("Consultando banco com SQL direto através do JS...");
  
  const { data: matriculas, error } = await supabase
    .from('matriculas')
    .select('unidade, turma_ref:turmas!inner(nome, professor), aluno:alunos!inner(nome_completo)')
    .eq('turmas.professor', 'Breno Maia')
    .ilike('status', 'ativo')
    .order('unidade')
    .order('turmas(nome)')
    .order('alunos(nome_completo)');

  if (error) {
    console.error('Erro na query inner join:', error);
    // Tentar de forma simples e fazer in-memory join
    const { data: turmas, error: turmasErr } = await supabase
        .from('turmas')
        .select('id, nome, professor')
        .eq('professor', 'Breno Maia');
    
    if (turmasErr) { console.error('Erro turmas:', turmasErr); return; }
    const turmaIds = turmas.map(t => t.id);
    const turmasMap = new Map(turmas.map(t => [t.id, t.nome]));

    const { data: mats, error: matsErr } = await supabase
        .from('matriculas')
        .select('aluno_id, unidade, turma_id')
        .in('turma_id', turmaIds)
        .ilike('status', 'ativo');
        
    if (matsErr) { console.error('Erro matriculas:', matsErr); return; }

    const alunoIds = [...new Set(mats.map(m => m.aluno_id))];
    const { data: alunos, error: alunosErr } = await supabase
        .from('alunos')
        .select('id, nome_completo')
        .in('id', alunoIds);

    if (alunosErr) { console.error('Erro alunos:', alunosErr); return; }
    const alunosMap = new Map(alunos.map(a => [a.id, a.nome_completo]));

    const result = mats.map(m => ({
        'Nome do Aluno': alunosMap.get(m.aluno_id) || '',
        'Unidade': m.unidade,
        'Turma': turmasMap.get(m.turma_id) || ''
    }));

    result.sort((a, b) => {
        if (a.Unidade !== b.Unidade) return a.Unidade.localeCompare(b.Unidade);
        if (a.Turma !== b.Turma) return a.Turma.localeCompare(b.Turma);
        return a['Nome do Aluno'].localeCompare(b['Nome do Aluno']);
    });

    const headers = ['Nome do Aluno', 'Unidade', 'Turma'];
    const csvRows = [headers.join(',')];

    result.forEach(row => {
        csvRows.push([`"${row['Nome do Aluno']}"`, `"${row.Unidade}"`, `"${row.Turma}"`].join(','));
    });

    const outputPath = '/Users/brunomaia/.gemini/antigravity/brain/09e5eb60-aed0-419e-b4ec-6fe921f6088a/Alunos_Judo_Breno.csv';
    fs.writeFileSync(outputPath, csvRows.join('\n'), 'utf-8');
    console.log(`CSV salvo em: ${outputPath} com ${result.length} alunos.`);
    
    return;
  }

}

exportJudoBrenoCSV();
