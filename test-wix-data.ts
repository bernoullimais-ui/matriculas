
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  const email = 'ricardosdavid@icloud.com';
  
  console.log(`Checking data for email: ${email}`);
  
  // 1. Find Responsavel
  const { data: resp } = await supabase.from('responsaveis').select('*').eq('email', email).single();
  if (!resp) {
    console.log('Responsavel not found');
    return;
  }
  console.log('Responsavel found:', resp.id, resp.nome_completo);
  
  // 2. Find Alunos
  const { data: alunos } = await supabase.from('alunos').select('*').eq('responsavel_id', resp.id);
  console.log('Alunos found:', alunos?.length);
  alunos?.forEach(a => console.log(`- Aluno: ${a.id}, ${a.nome_completo}`));
  
  // 3. Find Matriculas
  const studentIds = alunos?.map(a => a.id) || [];
  const { data: matriculas } = await supabase.from('matriculas').select('*').in('aluno_id', studentIds);
  console.log('Matriculas found:', matriculas?.length);
  matriculas?.forEach(m => console.log(`- Matricula: ${m.id}, Aluno: ${m.aluno_id}, Turma: ${m.turma}, Unidade: ${m.unidade}, Professor: ${m.professor}, Status: ${m.status}, Cancelamento: ${m.data_cancelamento}`));
  
  // 4. Find Wix Payments
  const { data: wixPayments } = await supabase.from('pagamentos_wix').select('*').eq('responsavel_id', resp.id);
  console.log('Wix Payments found:', wixPayments?.length);
  wixPayments?.forEach(p => console.log(`- Payment: ${p.id}, Matricula: ${p.matricula_id}, Aluno: ${p.aluno_id}, Item: ${p.nome_item}`));
}

checkData();
