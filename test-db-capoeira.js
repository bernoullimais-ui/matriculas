import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const fetchAll = async (table) => {
  let all = [];
  let from = 0;
  const limit = 1000;
  while (true) {
    const { data } = await supabase.from(table).select('*').range(from, from + limit - 1);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < limit) break;
    from += limit;
  }
  return all;
};

async function run() {
  const alunos = await fetchAll('alunos');
  const matriculas = await fetchAll('matriculas');
  const turmas = await fetchAll('turmas');

  const context = { alunos, matriculas, turmas };
  const unidadeAlvo = 'escola dom pedrinho';
  const modalidadeAlvo = 'capoeira';

  let count = 0;

  for (const aluno of context.alunos) {
    let matched = false;
    for (const matricula of context.matriculas) {
        if (matricula.aluno_id === aluno.id) {
            const statusMatricula = matricula.status ? matricula.status.toLowerCase() : '';
            if (['ativo', 'ativa'].includes(statusMatricula)) {
                const unidadeMatricula = matricula.unidade ? matricula.unidade.toLowerCase() : '';
                if (unidadeMatricula === unidadeAlvo) {
                    const turma = context.turmas.find(t => t.id === matricula.turma_id);
                    if (turma && turma.nome) {
                        if (turma.nome.toLowerCase().includes(modalidadeAlvo)) {
                            matched = true;
                            break;
                        }
                    }
                }
            }
        }
    }
    if (matched) count++;
  }
  
  console.log("Encontrados com IA + fetchAll:", count);
}
run();
