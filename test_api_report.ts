import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

async function test() {
  const url = 'https://matriculas-qfufxdupi-bernoullimais.vercel.app/api/admin/financial-report';
  const res = await fetch(url);
  const data = await res.json();
  const pagamentos = data.pagamentos || [];
  
  const emails = ['tauanacoutinho@gmail.com', 'trindadelivia@hotmail.com', 'rtavares.bomfim@gmail.com'];
  for (const p of pagamentos) {
    const email = p.cobranca_email || p.comprador_email;
    if (emails.includes(email)) {
      console.log(`\nPayment from ${email}:`);
      console.log(`  Produto: ${p.produto_nome || p.tipo_pedido}`);
      console.log(`  Responsavel: ${p.responsaveis?.nome_completo}`);
      console.log(`  Alunos: ${p.responsaveis?.alunos?.length}`);
      if (p.responsaveis?.alunos) {
        for (const a of p.responsaveis.alunos) {
          console.log(`    - Aluno: ${a.nome_completo} (ID: ${a.id})`);
          if (a.matriculas) {
            for (const m of a.matriculas) {
              console.log(`      * Mat: ${m.status}, Plano: ${m.plano}, Turma: ${m.turma}`);
            }
          }
        }
      }
    }
  }
}
test();
