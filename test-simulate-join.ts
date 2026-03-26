
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function simulateJoin() {
  const email = 'ricardosdavid@icloud.com';
  
  const [pRes, wRes, rRes, aRes, mRes] = await Promise.all([
    supabase.from('pagamentos').select('*'),
    supabase.from('pagamentos_wix').select('*'),
    supabase.from('responsaveis').select('id, nome_completo'),
    supabase.from('alunos').select('id, nome_completo, responsavel_id, turma_escolar'),
    supabase.from('matriculas').select('*')
  ]);

  const responsaveis = rRes.data || [];
  const alunos = aRes.data || [];
  const matriculas = mRes.data || [];
  const pagamentosWix = wRes.data || [];

  const mappedWix = pagamentosWix.map(w => ({
    ...w,
    id: w.id,
    responsavel_id: w.responsavel_id,
    matricula_id: w.matricula_id,
    aluno_id: w.aluno_id,
    is_wix: true
  }));

  const targetWix = mappedWix.filter(w => {
    const resp = responsaveis.find(r => String(r.id) === String(w.responsavel_id));
    return resp && resp.nome_completo.includes('Ricardo');
  });

  console.log(`Found ${targetWix.length} target Wix payments`);

  targetWix.forEach(p => {
    const resp = responsaveis.find(r => String(r.id) === String(p.responsavel_id));
    let respAlunos = [];

    if (p.matricula_id) {
      const mat = matriculas.find(m => String(m.id) === String(p.matricula_id));
      if (mat) {
        const aluno = alunos.find(a => String(a.id) === String(mat.aluno_id));
        if (aluno) {
          respAlunos = [{
            ...aluno,
            matriculas: [mat]
          }];
        } else {
          console.log(`- Aluno not found for mat.aluno_id: ${mat.aluno_id}`);
        }
      } else {
        console.log(`- Matricula not found for p.matricula_id: ${p.matricula_id}`);
      }
    }

    if (respAlunos.length === 0 && p.aluno_id) {
      const aluno = alunos.find(a => String(a.id) === String(p.aluno_id));
      if (aluno) {
        respAlunos = [{
          ...aluno,
          matriculas: matriculas.filter(m => String(m.aluno_id) === String(aluno.id))
        }];
      }
    }

    console.log(`Payment ${p.id}: respAlunos.length = ${respAlunos.length}`);
    if (respAlunos.length > 0) {
      console.log(`  - Student: ${respAlunos[0].nome_completo}`);
      console.log(`  - Matriculas: ${respAlunos[0].matriculas.length}`);
    }
  });
}

simulateJoin();
