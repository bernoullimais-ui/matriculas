
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

async function testReport() {
  try {
    console.log(`Fetching report from: ${APP_URL}/api/admin/financial-report`);
    const response = await axios.get(`${APP_URL}/api/admin/financial-report`);
    console.log('Response status:', response.status);
    if (Array.isArray(response.data)) {
      console.log('Response is an array with length:', response.data.length);
      console.log('First element keys:', Object.keys(response.data[0]));
      return;
    }
    if (!response.data || !response.data.pagamentos) {
      console.log('Response data structure:', Object.keys(response.data));
      return;
    }
    const pagamentos = response.data.pagamentos;
    
    const wixPayments = pagamentos.filter((p: any) => p.is_wix);
    console.log(`Found ${wixPayments.length} Wix payments in report`);
    
    const target = wixPayments.filter((p: any) => p.responsaveis?.nome_completo?.includes('Ricardo'));
    console.log(`Found ${target.length} Wix payments for Ricardo`);
    
    target.forEach((p: any) => {
      console.log(`Payment ID: ${p.id}`);
      console.log(`- matricula_id: ${p.matricula_id}`);
      console.log(`- aluno_id: ${p.aluno_id}`);
      console.log(`- responsaveis.alunos.length: ${p.responsaveis?.alunos?.length}`);
      if (p.responsaveis?.alunos?.length > 0) {
        const a = p.responsaveis.alunos[0];
        console.log(`  - Aluno: ${a.nome_completo}`);
        console.log(`  - Matriculas: ${a.matriculas?.length}`);
        if (a.matriculas?.length > 0) {
          console.log(`    - Matricula ID: ${a.matriculas[0].id}`);
          console.log(`    - Unidade: ${a.matriculas[0].unidade}`);
          console.log(`    - Turma: ${a.matriculas[0].turma}`);
        }
      }
      console.log('---');
    });
  } catch (error) {
    console.error('Error fetching report:', error);
  }
}

testReport();
