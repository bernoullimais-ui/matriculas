import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const superNormalize = (t: any) => 
  String(t || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');

async function run() {
  const apiKey = process.env.WIX_API_KEY;
  const accountId = process.env.WIX_ACCOUNT_ID;
  const siteId = process.env.WIX_SITE_ID_2 || 'ca1ea66d-ff08-4199-a149-34d09ecf0cc3';

  if (!apiKey || !accountId) {
    console.error('WIX_API_KEY or WIX_ACCOUNT_ID is missing from environment.');
    return;
  }

  const headers = {
    'Authorization': apiKey,
    'wix-account-id': accountId,
    'wix-site-id': siteId
  };

  const contactId = '3f89eb2a-64ac-4da7-8af5-d03e55574a5f';
  console.log('Fetching all orders for site ca1ea66d-ff08-4199-a149-34d09ecf0cc3 with pagination...');

  const contactOrders: any[] = [];
  let offset = 0;
  const limit = 50;
  let hasNext = true;
  let pageNum = 1;

  do {
    const params = { limit, offset };
    const resOrders = await axios.get('https://www.wixapis.com/pricing-plans/v2/orders', { headers, params });
    const page = resOrders.data.orders || [];
    
    const matches = page.filter((o: any) => o.buyer?.contactId === contactId);
    if (matches.length > 0) {
      contactOrders.push(...matches);
    }

    const meta = resOrders.data.pagingMetadata;
    hasNext = meta?.hasNext || false;
    offset += limit;
    if (page.length < limit || !hasNext) break;
    await new Promise(r => setTimeout(r, 100));
    pageNum++;
  } while (hasNext);

  console.log(`Found ${contactOrders.length} orders for Pedro.`);

  // Fetch db payments for Pedro
  const { data: dbPayments } = await supabase
    .from('pagamentos_wix')
    .select('*')
    .ilike('cobranca_email', 'lamylyaf@hotmail.com');

  const existingMap = new Map<string, any>();
  const signatureMap = new Map<string, any>();
  for (const row of dbPayments || []) {
    if (row.id_provedor_pagamento) {
      existingMap.set(row.id_provedor_pagamento, row);
    }
    const studentOrEmail = row.aluno_id || (row.cobranca_email || '').toLowerCase().trim();
    const date = row.data_pagamento_gmt_03 || row.data_transacao_gmt_03 || '';
    if (studentOrEmail && date && row.produto_nome) {
      const month = date.substring(0, 7);
      const plan = superNormalize(row.produto_nome);
      const sig = `${studentOrEmail}|${month}|${plan}`;
      signatureMap.set(sig, row);
    }
  }

  const aluno_id = '1f01f78e-484a-4a9c-aeef-cfb54d691dfc';

  for (const order of contactOrders) {
    console.log(`\n=============================================`);
    console.log(`Order: ${order.planName} (${order.id})`);
    console.log(`Status: ${order.status}, lastPaymentStatus: ${order.lastPaymentStatus}`);
    
    const currentCycleIndex = order.currentCycle?.index || 1;
    const orderCreatedDate = order.createdDate || order.currentCycle?.startedDate;
    
    const intervalUnit: string = (order.pricing?.subscription?.cycleDuration?.unit || 'MONTH').toUpperCase();
    const intervalCount: number = parseInt(order.pricing?.subscription?.cycleDuration?.count || '1');
    const daysPerCycle = intervalUnit === 'YEAR' ? intervalCount * 365
                       : intervalUnit === 'WEEK' ? intervalCount * 7
                       : intervalCount * 30; // MONTH default

    for (let cycleIndex = 1; cycleIndex <= currentCycleIndex; cycleIndex++) {
      const uniquePaymentId = `${order.id}-cycle-${cycleIndex}`;
      
      const cycleObj = order.cycles?.find((c: any) => c.index === cycleIndex);
      let cycleStartDate = cycleObj ? cycleObj.startedDate : null;

      if (!cycleStartDate) {
        cycleStartDate = orderCreatedDate;
        if (cycleIndex === currentCycleIndex && order.currentCycle?.startedDate) {
          cycleStartDate = order.currentCycle.startedDate;
        } else if (orderCreatedDate && cycleIndex > 1) {
          const baseDate = new Date(orderCreatedDate);
          baseDate.setDate(baseDate.getDate() + daysPerCycle * (cycleIndex - 1));
          cycleStartDate = baseDate.toISOString();
        }
      }

      const cycleStatus = cycleIndex === currentCycleIndex
        ? order.lastPaymentStatus
        : 'PAID';

      const statusLabel = cycleStatus === 'PAID' ? 'Bem-sucedido'
                         : cycleStatus === 'FAILED' ? 'Falhou'
                         : 'Pendente';

      const sig = `${aluno_id}|${cycleStartDate.substring(0, 7)}|${superNormalize(order.planName)}`;
      const existing = existingMap.get(uniquePaymentId) || signatureMap.get(sig);

      console.log(`\n  Cycle ${cycleIndex}: StartDate = ${cycleStartDate}, WixStatus = ${statusLabel}`);
      console.log(`    Signature: ${sig}`);
      if (existing) {
        console.log(`    EXISTING in DB: id=${existing.id}, date=${existing.data_pagamento_gmt_03}, status=${existing.status_transacao}, source=${existing.provedor_pagamento}`);
        
        const isExistingCron = existing.provedor_pagamento === 'Wix API Cron' || String(existing.id_provedor_pagamento).includes('-cycle-');
        if (!isExistingCron) {
          console.log(`    -> ACTION: Skip (manual/CSV exists)`);
          continue;
        }
        const existingStatusLower = String(existing.status_transacao || '').toLowerCase();
        const isExistingFailed = existingStatusLower.includes('falh') || existingStatusLower.includes('recus');
        const statusLabelLower = statusLabel.toLowerCase();
        const isNewFailed = statusLabelLower.includes('falh') || statusLabelLower.includes('recus');

        if (isExistingFailed && !isNewFailed) {
          console.log(`    -> ACTION: Skip (prevent overwriting failure status)`);
          continue;
        }

        if (existing.status_transacao !== statusLabel) {
          console.log(`    -> ACTION: Update status to ${statusLabel}`);
        } else {
          console.log(`    -> ACTION: No-op (status matches)`);
        }
      } else {
        console.log(`    -> ACTION: Insert as ${statusLabel}`);
      }
    }
  }
}
run().catch(console.error);
