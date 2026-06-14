import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testCheckoutLogic() {
  const matriculaId = 'acda1225-52d2-4d60-8146-3a54e27eadee';
  const { data: matricula } = await supabase
    .from('matriculas')
    .select('*, alunos(*)')
    .eq('id', matriculaId)
    .maybeSingle();

  if (!matricula) return console.error("Matrícula não encontrada");

  console.log("Matricula Fetch:", matricula.turma_id);

  const { data: classData, error } = await supabase
    .from('turmas')
    .select('id, valor_mensalidade, precos_unidade, identidade')
    .eq('id', matricula.turma_id)
    .maybeSingle();
    
  console.log("ClassData Fetch:", classData, error);

  let valorCobrado = classData?.precos_unidade?.[matricula.unidade] ?? (classData?.valor_mensalidade || 0);
  console.log("Initial valorCobrado:", valorCobrado);

  if (matricula.valor_desconto) {
    valorCobrado -= Number(matricula.valor_desconto);
    console.log("After desconto:", valorCobrado);
  }
  if (matricula.tem_fidelidade) {
    valorCobrado = valorCobrado * 0.9;
    console.log("After fidelidade:", valorCobrado);
  }
  if (valorCobrado < 0) valorCobrado = 0;

  console.log("Final valorCobrado:", valorCobrado);
  console.log("Amount Pagar.me (cents):", Math.round(valorCobrado * 100));
}

testCheckoutLogic();
