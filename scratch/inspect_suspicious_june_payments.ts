import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
const apiKey = process.env.WIX_API_KEY!;
const accountId = process.env.WIX_ACCOUNT_ID!;
const siteIds = ['b4fb0ff7-7e69-4f24-8cd5-5551ce7720b1', 'ca1ea66d-ff08-4199-a149-34d09ecf0cc3'];

async function run() {
  console.log("Fetching June 2026 payments...");
  const { data: payments, error } = await supabase
    .from('pagamentos_wix')
    .select('id, id_provedor_pagamento, cobranca_email, cobranca_nome, produto_nome, valor, status_transacao, data_pagamento_gmt_03, id_pedido')
    .like('data_pagamento_gmt_03', '2026-06-%')
    .eq('provedor_pagamento', 'Wix API Cron')
    .eq('status_transacao', 'Bem-sucedido');

  if (error) {
    console.error("Error fetching payments:", error);
    return;
  }

  console.log(`Found ${payments?.length || 0} successful Wix API Cron payments in June 2026.`);

  // Load all Wix orders for both sites to check status
  const wixOrdersMap = new Map<string, any>();
  for (const siteId of siteIds) {
    try {
      console.log(`Fetching orders for site ${siteId}...`);
      const response = await axios.get('https://www.wixapis.com/pricing-plans/v2/orders?limit=50', {
        headers: {
          'Authorization': apiKey,
          'wix-account-id': accountId,
          'wix-site-id': siteId
        }
      });
      const orders = response.data.orders || [];
      for (const order of orders) {
        wixOrdersMap.set(order.id, order);
      }
    } catch (e: any) {
      console.error(`Error fetching orders for site ${siteId}:`, e.message);
    }
  }

  console.log(`Loaded ${wixOrdersMap.size} orders from Wix API.`);

  // Analyze discrepancies
  const discrepancies = [];

  for (const payment of payments) {
    // Extract wixOrderId from id_provedor_pagamento (format: wixOrderId-cycle-N)
    const provId = payment.id_provedor_pagamento || '';
    const parts = provId.split('-cycle-');
    const wixOrderId = parts[0];
    const cycleIndex = parseInt(parts[1] || '0');

    if (!wixOrderId) continue;

    const wixOrder = wixOrdersMap.get(wixOrderId);
    if (!wixOrder) {
      // Order not found in the recent list (could be older, but still check if we can query it directly)
      continue;
    }

    const orderStatus = wixOrder.status; // ACTIVE, CANCELED, PAUSED, etc.
    const lastPaymentStatus = wixOrder.lastPaymentStatus; // PAID, FAILED, etc.
    
    // Check if the order is canceled or paused
    if (orderStatus === 'CANCELED' || orderStatus === 'PAUSED') {
      discrepancies.push({
        paymentId: payment.id,
        provId,
        email: payment.cobranca_email,
        name: payment.cobranca_nome,
        product: payment.produto_nome,
        status_db: payment.status_transacao,
        wixOrderStatus: orderStatus,
        wixLastPaymentStatus: lastPaymentStatus,
        reason: `Wix Order is ${orderStatus}`
      });
    }
    
    // If the customer is Rebeca, print her details as reference
    if (payment.cobranca_email === 'rebecabrasilcosta@gmail.com') {
      console.log(`\n[Reference Rebeca] Payment: ${provId} | Wix Order Status: ${orderStatus} | Wix LastPaymentStatus: ${lastPaymentStatus}`);
    }
  }

  console.log(`\nFound ${discrepancies.length} discrepancy candidates:`);
  console.table(discrepancies);
}

run();
