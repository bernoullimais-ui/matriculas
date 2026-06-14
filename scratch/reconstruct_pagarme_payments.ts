import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.production' });
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const PAGARME_SECRET_KEY = process.env.PAGARME_SECRET_KEY;
const authHeader = Buffer.from(`${PAGARME_SECRET_KEY}:`).toString('base64');

async function reconstruct() {
  console.log('🔄 Iniciando reconstrução limpa do histórico Pagar.me...');

  // 1. Obter todas as matrículas que têm pagarme_subscription_id
  const { data: matriculas, error: mErr } = await supabase
    .from('matriculas')
    .select('id, aluno_id, pagarme_subscription_id, alunos(responsavel_id)')
    .not('pagarme_subscription_id', 'is', null);

  if (mErr) {
    console.error('Erro ao carregar matriculas:', mErr.message);
    return;
  }

  console.log(`Encontradas ${matriculas?.length} matrículas com assinaturas Pagar.me.`);
  const matriculaIds = matriculas.map(m => m.id);

  if (matriculaIds.length === 0) {
    console.log('Nenhuma matrícula com assinatura Pagar.me encontrada.');
    return;
  }

  // 2. Deletar todos os registros de pagamentos destas matrículas que contêm vínculo Pagar.me
  // (Ou seja, pagarme não é nulo)
  console.log('Deletando lançamentos antigos do Pagar.me para evitar duplicados e datas corrompidas...');
  const { error: delErr } = await supabase
    .from('pagamentos')
    .delete()
    .in('matricula_id', matriculaIds)
    .not('pagarme', 'is', null);

  if (delErr) {
    console.error('Erro ao deletar pagamentos antigos:', delErr.message);
    return;
  }
  console.log('✅ Pagamentos antigos vinculados ao Pagar.me excluídos com sucesso.');

  // 3. Sincronizar do zero buscando todas as faturas pagas da API Pagar.me (até 20 páginas = 1000 faturas)
  let page = 1;
  let totalProcessed = 0;
  let totalCreated = 0;
  
  while (true) {
    try {
      console.log(`Buscando página ${page} de faturas pagas no Pagar.me...`);
      const response = await axios.get(`https://api.pagar.me/core/v5/invoices?status=paid&page=${page}&size=50`, {
        headers: { 'Authorization': `Basic ${authHeader}` }
      });
      
      const invoices = response.data.data;
      if (!invoices || invoices.length === 0) {
        break; // Sem mais faturas
      }
      
      for (const invoice of invoices) {
        totalProcessed++;
        const invoiceId = invoice.id;
        const subscriptionId = invoice.subscription_id || (invoice.subscription ? invoice.subscription.id : null);
        
        if (!subscriptionId) {
          continue; // Não é fatura de assinatura
        }
        
        // Achar a matrícula correspondente
        let matriculaId = null;
        let responsavelId = null;
        let alunoId = null;

        // 1. Tentar achar por pagarme_subscription_id na tabela matriculas
        const matricula = matriculas.find(m => m.pagarme_subscription_id === subscriptionId);

        if (matricula) {
          matriculaId = matricula.id;
          alunoId = matricula.aluno_id;
          responsavelId = (matricula as any).alunos?.responsavel_id;
        } else {
          // Fallback: pesquisar no banco geral por matricula com essa assinatura
          const { data: dbMat } = await supabase
            .from('matriculas')
            .select('id, aluno_id, alunos(responsavel_id)')
            .eq('pagarme_subscription_id', subscriptionId)
            .maybeSingle();

          if (dbMat) {
            matriculaId = dbMat.id;
            alunoId = dbMat.aluno_id;
            responsavelId = (dbMat as any).alunos?.responsavel_id;
          }
        }

        if (!matriculaId) {
          console.log(`⚠️ Fatura ${invoiceId}: Matrícula não encontrada para assinatura ${subscriptionId}`);
          continue;
        }

        const valorReal = invoice.amount / 100;
        const mappedMethod = invoice.payment_method === 'credit_card' ? 'cartao_credito'
                           : invoice.payment_method === 'pix' ? 'pix'
                           : 'cartao_credito';
                           
        const actualPaidAt = invoice.charge?.paid_at || invoice.paid_at || invoice.due_at || invoice.created_at;

        const newPayment = {
          matricula_id: matriculaId,
          responsavel_id: responsavelId || null,
          aluno_id: alunoId || null,
          status: 'pago',
          metodo_pagamento: mappedMethod,
          valor: valorReal,
          data_vencimento: invoice.due_at || new Date(invoice.created_at).toISOString(),
          pagarme: invoiceId,
          data_pagamento: actualPaidAt || new Date().toISOString()
        };
        
        const { error: insertError } = await supabase
          .from('pagamentos')
          .insert([newPayment]);
          
        if (insertError) {
          console.error(`❌ Fatura ${invoiceId}: Erro ao inserir no banco: ${insertError.message}`);
        } else {
          totalCreated++;
          console.log(`✅ Fatura ${invoiceId} importada com sucesso! (R$ ${valorReal})`);
        }
      }
      
      page++;
      if (page > 20) break; // Limite de segurança (1000 faturas)
      
    } catch (err: any) {
      console.error('Erro na API Pagar.me:', err.response?.data || err.message);
      break;
    }
  }
  
  console.log('\n──────────────────────────────────────────');
  console.log('📊 RELATÓRIO DE RECONSTRUÇÃO:');
  console.log(`   Faturas analisadas : ${totalProcessed}`);
  console.log(`   ✅ Criadas limpas   : ${totalCreated}`);
  console.log('──────────────────────────────────────────');
}

reconstruct();
