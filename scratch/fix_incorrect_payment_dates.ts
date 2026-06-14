import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.production' });
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const PAGARME_SECRET_KEY = process.env.PAGARME_SECRET_KEY;
const authHeader = Buffer.from(`${PAGARME_SECRET_KEY}:`).toString('base64');

async function fixDates() {
  console.log('🔄 Iniciando correção das datas de pagamento do Pagar.me...');
  
  let page = 1;
  let totalProcessed = 0;
  let totalFixed = 0;
  
  while (true) {
    try {
      console.log(`\nBuscando página ${page} de faturas da API Pagar.me...`);
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
        
        // Verifica se essa fatura existe no banco de dados
        const { data: dbPayment, error: fetchErr } = await supabase
          .from('pagamentos')
          .select('id, data_pagamento, data_vencimento')
          .eq('pagarme', invoiceId)
          .maybeSingle();
          
        if (fetchErr) {
          console.error(`Erro ao buscar ${invoiceId} do banco:`, fetchErr.message);
          continue;
        }
        
        if (!dbPayment) {
          // Não está no banco, não precisamos corrigir aqui (mas o cron/script de sync vai importar futuramente se necessário)
          continue;
        }
        
        // A data de pagamento correta vem de invoice.charge.paid_at ou fallback no due_at/created_at
        const actualPaidAt = invoice.charge?.paid_at || invoice.paid_at || invoice.due_at || invoice.created_at;
        
        if (!actualPaidAt) {
          console.log(`⚠️ Fatura ${invoiceId}: Nenhuma data de pagamento encontrada.`);
          continue;
        }
        
        // Se a data de pagamento gravada no banco começa com a data de hoje (quando rodou o sync incorreto)
        // ou se simplesmente queremos atualizar para garantir a data 100% correta
        const dbDateStr = dbPayment.data_pagamento || '';
        const isTodaySync = dbDateStr.startsWith('2026-06-04T14:');
        
        if (isTodaySync || dbDateStr !== actualPaidAt) {
          console.log(`✏️ Corrigindo data de ${invoiceId}: Banco = ${dbDateStr} ➡️ Pagar.me = ${actualPaidAt}`);
          
          const { error: updateErr } = await supabase
            .from('pagamentos')
            .update({ data_pagamento: actualPaidAt })
            .eq('id', dbPayment.id);
            
          if (updateErr) {
            console.error(`❌ Erro ao atualizar ${invoiceId}:`, updateErr.message);
          } else {
            totalFixed++;
          }
        }
      }
      
      page++;
      // Limite de segurança de páginas
      if (page > 10) break;
      
    } catch (err: any) {
      console.error('Erro ao conectar com API Pagar.me:', err.response?.data || err.message);
      break;
    }
  }
  
  console.log('\n──────────────────────────────────────────');
  console.log(`📊 RELATÓRIO DE CORREÇÃO DE DATAS:`);
  console.log(`   Faturas analisadas  : ${totalProcessed}`);
  console.log(`   ✅ Datas corrigidas : ${totalFixed}`);
  console.log('──────────────────────────────────────────');
}

fixDates();
