import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

async function run() {
  const [mRes, tRes, aRes, rRes] = await Promise.all([
    supabase.from('matriculas').select('*'),
    supabase.from('turmas').select('*'),
    supabase.from('alunos').select('*'),
    supabase.from('responsaveis').select('*')
  ]);

  const matriculas = mRes.data || [];
  const turmas = tRes.data || [];
  
  const limitStart = new Date('2026-06-01');
  const limitEnd = new Date('2026-06-30T23:59:59Z');

  // Filter raw enrollments like in the frontend
  const filtered = matriculas.filter((m: any) => {
    if (m.status !== 'ativo' && m.status !== 'Ativo') return false;

    const enrolDate = m.data_matricula ? new Date(m.data_matricula) : null;
    const cancelDate = m.data_cancelamento ? new Date(m.data_cancelamento) : null;
    if (enrolDate && enrolDate > limitEnd) return false;
    if (cancelDate && cancelDate < limitStart) return false;

    return true;
  });

  let brutoTotal = 0;
  let descontoTotal = 0;
  let liquidoTotal = 0;
  let totalItemsCount = 0;
  let discountsAppliedCount = 0;

  filtered.forEach((m: any) => {
    const turma = turmas.find((t: any) => String(t.id) === String(m.turma_id) || (t.nome === m.turma && t.unidade_nome === m.unidade));
    const price = turma?.valor_mensalidade || 0;
    const isIntegral = String(m.plano || '').toLowerCase().includes('integral');
    const discount = isIntegral ? price * 0.3 : 0;
    const net = price - discount;

    brutoTotal += price;
    descontoTotal += discount;
    liquidoTotal += net;
    totalItemsCount++;
    if (discount > 0) discountsAppliedCount++;
  });

  console.log(`June 2026 Receita Projetada Calculations:`);
  console.log(`  Mensalidades: ${totalItemsCount}`);
  console.log(`  Bruto Total: R$ ${brutoTotal.toFixed(2)}`);
  console.log(`  Desconto Total: R$ ${descontoTotal.toFixed(2)}`);
  console.log(`  Líquido Total: R$ ${liquidoTotal.toFixed(2)}`);
  console.log(`  Descontos Aplicados: ${discountsAppliedCount}`);
}

run();
