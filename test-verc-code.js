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
  
  const code = `
if (!context.matriculas) {
    return false;
}

const studentEnrollments = context.matriculas.filter(m => m.aluno_id === context.aluno.id);

if (studentEnrollments.length === 0) {
    return false; // Aluno não possui matrículas
}

const targetYear = 2025;
const currentYear = new Date().getFullYear();

let hasEnrollmentInTargetYear = false;

for (const matricula of studentEnrollments) {
    // 1. Verificar se a data de criação da matrícula existe e é válida
    if (!matricula.created_at) {
        return false; // Dados malformados, safer to exclude
    }

    const createdAtYear = new Date(matricula.created_at).getFullYear();

    // 2. Todas as matrículas do aluno devem ter sido criadas no ano alvo (2025)
    if (createdAtYear !== targetYear) {
        return false; // Encontrada matrícula criada fora de 2025, não atende a "APENAS em 2025"
    }

    // 3. Se a matrícula foi criada em 2025, sua atividade deve estar confinada a 2025.
    // Isso é relevante se o ano atual for posterior a 2025.
    if (matricula.status && matricula.status.toLowerCase() === 'ativo') {
        // Se a matrícula está ativa e o ano atual é posterior ao ano alvo,
        // significa que a atividade se estende além de 2025.
        if (currentYear > targetYear) {
            return false; // Matrícula ativa encontrada, mas o ano atual é posterior a 2025. Viola "apenas em 2025".
        }
        // Se o ano atual é 2025, uma matrícula ativa ainda está dentro do critério "apenas em 2025" por enquanto.
    } else if (matricula.status && matricula.status.toLowerCase() === 'cancelado') {
        // Se a matrícula foi cancelada, a data de cancelamento deve estar em 2025.
        if (!matricula.data_cancelamento) {
            return false; // Matrícula cancelada sem data de cancelamento, dados malformados.
        }
        const cancelYear = new Date(matricula.data_cancelamento).getFullYear();
        if (cancelYear !== targetYear) {
            // Se cancelada fora de 2025, a atividade se estendeu além ou terminou antes de 2025.
            return false;
        }
    } else {
        // Status desconhecido ou não 'ativo'/'cancelado'. Para "apenas em 2025",
        // precisamos de um ciclo de vida claro dentro do ano. Excluir por segurança.
        return false;
    }

    hasEnrollmentInTargetYear = true; // Pelo menos uma matrícula passou por todas as verificações para 2025
}

return hasEnrollmentInTargetYear;
  `;
  
  const filterFn = new Function('context', code);
  let count = 0;
  for (const aluno of alunos) {
    if (filterFn({ aluno, matriculas })) {
        count++;
    }
  }
  console.log("Count with vercel code:", count);
}
run();
