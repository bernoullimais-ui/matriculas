import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function test() {
  const emails = ['rtavares.bomfim@gmail.com', 'tauanacoutinho@gmail.com', 'trindadelivia@hotmail.com'];
  for (const email of emails) {
    const { data: resp } = await supabase.from('responsaveis').select('*').ilike('email', email);
    console.log(`Email ${email} found in responsaveis:`, resp ? resp.length : 0);
    if (resp && resp.length > 0) {
      for (const r of resp) {
        const { data: alunos } = await supabase.from('alunos').select('*').eq('responsavel_id', r.id);
        console.log(`  - Resp ${r.id} (${r.nome_completo}) has ${alunos?.length || 0} alunos`);
        if (alunos) {
          for (const a of alunos) {
            const { data: mats } = await supabase.from('matriculas').select('*').eq('aluno_id', a.id);
            console.log(`    * Aluno ${a.id} (${a.nome_completo}) has ${mats?.length || 0} matriculas`);
            mats?.forEach((m: any) => {
              console.log(`      - Matrícula: ${m.status}, Turma: ${m.turma}, Plano: ${m.plano}, Unidade: ${m.unidade}`);
            });
          }
        }
      }
    }
  }
}

test();
