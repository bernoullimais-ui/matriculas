import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const run0 = `
if (!context.matriculas) {
    return false;
}

const alunoId = context.aluno.id;
const targetYear = 2025;
const FAR_FUTURE_DATE = new Date('9999-12-31T23:59:59Z');

const filteredMatriculas = context.matriculas.filter(m => m.aluno_id === alunoId);

if (filteredMatriculas.length === 0) {
    return false;
}

const startOfTargetYear = new Date(\`\${targetYear}-01-01T00:00:00Z\`);
const endOfTargetYear = new Date(\`\${targetYear}-12-31T23:59:59Z\`);
const endOfBeforeTargetYear = new Date(\`\${targetYear - 1}-12-31T23:59:59Z\`);
const startOfAfterTargetYear = new Date(\`\${targetYear + 1}-01-01T00:00:00Z\`);
const startOfBeforeTargetYear = new Date('1970-01-01T00:00:00Z');

let hasAnyEnrollmentActiveInTargetYear = false;

for (const matricula of filteredMatriculas) {
    const enrollmentStart = new Date(matricula.data_matricula);
    let enrollmentEnd;

    if (matricula.status && matricula.status.toLowerCase() === 'ativo') {
        enrollmentEnd = FAR_FUTURE_DATE;
    } else if (matricula.data_cancelamento) {
        enrollmentEnd = new Date(matricula.data_cancelamento);
    } else {
        enrollmentEnd = enrollmentStart; 
    }

    const activeInTargetYear = (enrollmentStart <= endOfTargetYear) && (enrollmentEnd >= startOfTargetYear);
    if (activeInTargetYear) {
        hasAnyEnrollmentActiveInTargetYear = true;
    }

    const activeBeforeTargetYear = (enrollmentStart <= endOfBeforeTargetYear) && (enrollmentEnd >= startOfBeforeTargetYear);
    if (activeBeforeTargetYear) {
        return false; 
    }

    const activeAfterTargetYear = (enrollmentStart <= FAR_FUTURE_DATE) && (enrollmentEnd >= startOfAfterTargetYear);
    if (activeAfterTargetYear) {
        return false; 
    }
}

return hasAnyEnrollmentActiveInTargetYear;
`;

const run1 = `
if (!context.matriculas || !Array.isArray(context.matriculas)) {
    return false;
}

const studentId = context.aluno.id;
const targetYear = 2025;
const currentYear = new Date().getFullYear();

let hasEnrollmentActiveInTargetYear = false; 

const studentEnrollments = context.matriculas.filter(m => m.aluno_id === studentId);

if (studentEnrollments.length === 0) {
    return false; 
}

for (const matricula of studentEnrollments) {
    const matriculaStartDateStr = matricula.data_matricula || matricula.created_at;
    if (!matriculaStartDateStr) {
        continue;
    }
    const matriculaStartDate = new Date(matriculaStartDateStr);
    const matriculaStartYear = matriculaStartDate.getFullYear();

    const status = matricula.status ? matricula.status.toLowerCase() : '';

    if (matriculaStartYear !== targetYear) {
        return false;
    }

    if (status.includes('ativo')) {
        if (currentYear > targetYear) {
            return false;
        }
        hasEnrollmentActiveInTargetYear = true;
    } else if (status.includes('cancelado')) {
        if (matricula.data_cancelamento) {
            const cancelDate = new Date(matricula.data_cancelamento);
            if (cancelDate.getFullYear() > targetYear) {
                return false;
            }
            if (cancelDate.getFullYear() >= targetYear) { 
                hasEnrollmentActiveInTargetYear = true;
            }
        } else {
            hasEnrollmentActiveInTargetYear = true;
        }
    }
}

return hasEnrollmentActiveInTargetYear;
`;

const run2 = `
const targetYear = 2025;

if (!context.matriculas || !Array.isArray(context.matriculas)) {
    return false;
}

const studentMatriculas = context.matriculas.filter(m => m.aluno_id === context.aluno.id);

if (studentMatriculas.length === 0) {
    return false;
}

const yearStart = new Date(\`\${targetYear}-01-01T00:00:00.000Z\`);
const yearEnd = new Date(\`\${targetYear}-12-31T23:59:59.999Z\`);

let hadEnrollmentInTargetYear = false;
let hadEnrollmentOutsideTargetYear = false;

for (const matricula of studentMatriculas) {
    const enrollmentStartDate = new Date(matricula.data_matricula || matricula.created_at);
    const enrollmentCancelDate = matricula.data_cancelamento ? new Date(matricula.data_cancelamento) : null;
    const isEnrollmentCurrentlyActive = ['ativo', 'ativa'].includes(matricula.status.toLowerCase());

    let effectiveEndDate;
    if (isEnrollmentCurrentlyActive) {
        effectiveEndDate = new Date(); 
    } else if (enrollmentCancelDate) {
        effectiveEndDate = enrollmentCancelDate;
    } else {
        effectiveEndDate = enrollmentStartDate;
    }

    const activeDuringTargetYear = (enrollmentStartDate <= yearEnd) && (effectiveEndDate >= yearStart);

    if (activeDuringTargetYear) {
        hadEnrollmentInTargetYear = true;
    }

    const activeBeforeTargetYear = enrollmentStartDate < yearStart && effectiveEndDate >= yearStart;
    const activeAfterTargetYear = enrollmentStartDate > yearEnd || (enrollmentStartDate <= yearEnd && effectiveEndDate > yearEnd);

    if (activeBeforeTargetYear || activeAfterTargetYear) {
        hadEnrollmentOutsideTargetYear = true;
        break;
    }
}

return hadEnrollmentInTargetYear && !hadEnrollmentOutsideTargetYear;
`;

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

async function testAll() {
  const alunos = await fetchAll('alunos');
  const matriculas = await fetchAll('matriculas');
  
  for(let i=0; i<3; i++) {
     let code = [run0, run1, run2][i];
     const filterFn = new Function('context', code);
     let count = 0;
     for (const aluno of alunos) {
       if (filterFn({ aluno, matriculas })) {
         count++;
       }
     }
     console.log(`Run ${i} count:`, count);
  }
}

testAll();
