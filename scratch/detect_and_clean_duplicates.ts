import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.production' });
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const PAGARME_SECRET_KEY = process.env.PAGARME_SECRET_KEY;
const authHeader = Buffer.from(`${PAGARME_SECRET_KEY}:`).toString('base64');

async function clean() {
  console.log('🔄 Iniciando auditoria e limpeza de duplicatas do Pagar.me...');

  // 1. Fetch all payments from Supabase
  const { data: allPayments, error: pErr } = await supabase
    .from('pagamentos')
    .select('id, aluno_id, matricula_id, valor, status, pagarme, data_vencimento, data_pagamento, created_at, metodo_pagamento');

  if (pErr) {
    console.error('Error fetching payments:', pErr.message);
    return;
  }

  // 2. Fetch all paid invoices from Pagar.me
  const invoicesMap = new Map<string, any>();
  let page = 1;
  while (true) {
    try {
      console.log(`Buscando página ${page} de faturas Pagar.me...`);
      const response = await axios.get(`https://api.pagar.me/core/v5/invoices?status=paid&page=${page}&size=50`, {
        headers: { 'Authorization': `Basic ${authHeader}` }
      });
      const data = response.data.data;
      if (!data || data.length === 0) break;
      for (const inv of data) {
        invoicesMap.set(inv.id, inv);
      }
      page++;
      if (page > 10) break;
    } catch (err: any) {
      console.error('Error fetching invoices from Pagar.me:', err.message);
      break;
    }
  }

  console.log(`Carregadas ${invoicesMap.size} faturas pagas do Pagar.me.`);

  // 3. Find duplicates
  // Group database payments by matricula_id and date month
  const paymentsByMatricula = new Map<string, any[]>();
  for (const p of allPayments || []) {
    if (p.matricula_id) {
      const list = paymentsByMatricula.get(p.matricula_id) || [];
      list.push(p);
      paymentsByMatricula.set(p.matricula_id, list);
    }
  }

  const toDeleteIds: string[] = [];

  for (const [matriculaId, list] of paymentsByMatricula.entries()) {
    // Group by month of data_vencimento or data_pagamento
    const monthGroups: { [key: string]: any[] } = {};
    for (const p of list) {
      // We care about paid Pagar.me payments or those with sub_ / in_ / ch_
      const isPagarme = p.pagarme || p.metodo_pagamento === 'cartao_credito' || p.metodo_pagamento === 'cartão';
      if (!isPagarme) continue;

      const dateStr = p.data_vencimento || p.data_pagamento || p.created_at || '';
      const month = dateStr.substring(0, 7); // YYYY-MM
      if (month) {
        if (!monthGroups[month]) monthGroups[month] = [];
        monthGroups[month].push(p);
      }
    }

    for (const [month, group] of Object.entries(monthGroups)) {
      if (group.length > 1) {
        console.log(`\nMatrícula: ${matriculaId} | Mês: ${month} (tem ${group.length} lançamentos)`);
        
        // Find which payments are actual Pagar.me invoices
        const invoicePayments = group.filter(p => p.pagarme && p.pagarme.startsWith('in_'));
        const subPayments = group.filter(p => p.pagarme && p.pagarme.startsWith('sub_'));
        const nullPayments = group.filter(p => !p.pagarme);
        const chargePayments = group.filter(p => p.pagarme && p.pagarme.startsWith('ch_'));

        console.log(`  - Invoices: ${invoicePayments.map(p => p.pagarme).join(', ')}`);
        console.log(`  - Subscriptions: ${subPayments.map(p => p.pagarme).join(', ')}`);
        console.log(`  - Charges/Nulls: ${[...chargePayments, ...nullPayments].map(p => p.id).join(', ')}`);

        // Rule 1: If there is an invoice payment (in_...) AND a subscription payment (sub_...) in the same month:
        // The subscription payment is a duplicate created by the webhook and can be removed.
        // But wait! Make sure we don't delete the checkout payment if it's the only one for that period.
        // If they are in the same month and there is an invoice payment, the invoice payment is the definitive one.
        if (invoicePayments.length > 0 && subPayments.length > 0) {
          for (const sp of subPayments) {
            console.log(`  ❌ Marcado para exclusão (duplicata sub_ vs in_): ID ${sp.id} (Pagarme: ${sp.pagarme})`);
            toDeleteIds.push(sp.id);
          }
        }

        // Rule 2: If there are multiple subscription payments (sub_...) in the same month:
        // Keep only one (usually the oldest or newest, let's keep the one that matches checkout or the one that isn't duplicate).
        if (subPayments.length > 1) {
          // Sort by created_at ascending
          const sortedSub = [...subPayments].sort((a, b) => a.created_at.localeCompare(b.created_at));
          // Keep the first, delete the rest
          for (let i = 1; i < sortedSub.length; i++) {
            console.log(`  ❌ Marcado para exclusão (duplicata sub_ extra): ID ${sortedSub[i].id} (Pagarme: ${sortedSub[i].pagarme})`);
            toDeleteIds.push(sortedSub[i].id);
          }
        }
      }
    }
  }

  console.log(`\nTotal de pagamentos marcados para exclusão: ${toDeleteIds.length}`);

  if (toDeleteIds.length > 0) {
    const { error: delErr } = await supabase
      .from('pagamentos')
      .delete()
      .in('id', toDeleteIds);

    if (delErr) {
      console.error('Erro ao deletar duplicatas:', delErr.message);
    } else {
      console.log(`🎉 Sucesso! Deletadas ${toDeleteIds.length} duplicatas do banco de dados.`);
    }
  }
}

clean();
