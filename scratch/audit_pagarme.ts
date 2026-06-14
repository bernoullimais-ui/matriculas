import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.production' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
const PAGARME_SECRET_KEY = process.env.PAGARME_SECRET_KEY;
const authHeader = Buffer.from(`${PAGARME_SECRET_KEY}:`).toString('base64');

async function run() {
  console.log("=== STARTING PAGAR.ME AUDIT ===");

  // 1. Load all database payments with Pagar.me IDs to prevent repeating queries
  const { data: dbPayments, error: dbError } = await supabase
    .from('pagamentos')
    .select('id, valor, status, data_vencimento, data_pagamento, pagarme, matricula_id');

  if (dbError) {
    console.error("Error loading database payments:", dbError);
    return;
  }

  console.log(`Loaded ${dbPayments.length} total database payments.`);
  const dbPagarmeMap = new Map<string, any>();
  for (const p of dbPayments) {
    if (p.pagarme) {
      dbPagarmeMap.set(p.pagarme.trim().toLowerCase(), p);
    }
  }
  console.log(`Loaded ${dbPagarmeMap.size} database payments with Pagar.me ID mapping.`);

  // 2. Fetch paid invoices from Pagar.me
  console.log("\n--- Fetching paid invoices from Pagar.me ---");
  const pmInvoices: any[] = [];
  let page = 1;
  while (true) {
    try {
      const response = await axios.get(`https://api.pagar.me/core/v5/invoices?status=paid&page=${page}&size=100`, {
        headers: { 'Authorization': `Basic ${authHeader}` }
      });
      const data = response.data.data || [];
      if (data.length === 0) break;
      pmInvoices.push(...data);
      console.log(`Page ${page}: fetched ${data.length} invoices (total: ${pmInvoices.length})`);
      page++;
      if (page > 15) break; // Limit to 1500 records
    } catch (e: any) {
      console.error(`Error fetching page ${page}:`, e.message);
      break;
    }
  }

  // 3. Fetch paid charges from Pagar.me
  console.log("\n--- Fetching paid charges from Pagar.me ---");
  const pmCharges: any[] = [];
  page = 1;
  while (true) {
    try {
      const response = await axios.get(`https://api.pagar.me/core/v5/charges?status=paid&page=${page}&size=100`, {
        headers: { 'Authorization': `Basic ${authHeader}` }
      });
      const data = response.data.data || [];
      if (data.length === 0) break;
      pmCharges.push(...data);
      console.log(`Page ${page}: fetched ${data.length} charges (total: ${pmCharges.length})`);
      page++;
      if (page > 15) break; // Limit to 1500 records
    } catch (e: any) {
      console.error(`Error fetching page ${page}:`, e.message);
      break;
    }
  }

  // 4. Analyze Invoices
  console.log("\n=== ANALYZING INVOICES ===");
  let missingInvoices = 0;
  let matchedInvoices = 0;
  const missingInvoiceList: any[] = [];

  for (const inv of pmInvoices) {
    const key = inv.id.trim().toLowerCase();
    if (dbPagarmeMap.has(key)) {
      matchedInvoices++;
    } else {
      missingInvoices++;
      missingInvoiceList.push({
        id: inv.id,
        subscription_id: inv.subscription_id,
        amount: inv.amount / 100,
        due_at: inv.due_at,
        paid_at: inv.paid_at,
        customer_name: inv.customer?.name,
        customer_email: inv.customer?.email
      });
    }
  }

  console.log(`Invoices summary:`);
  console.log(`  - Matched: ${matchedInvoices}`);
  console.log(`  - Missing: ${missingInvoices}`);

  if (missingInvoiceList.length > 0) {
    console.log(`Sample of missing invoices (first 10):`);
    console.table(missingInvoiceList.slice(0, 10));
  }

  // 5. Analyze Charges
  console.log("\n=== ANALYZING CHARGES ===");
  let missingCharges = 0;
  let matchedCharges = 0;
  const missingChargeList: any[] = [];

  for (const ch of pmCharges) {
    const key = ch.id.trim().toLowerCase();
    // A charge could be mapped in the database by its charge ID or invoice ID (if the invoice ID was recorded).
    // Let's check if the database has either.
    const hasDirectMatch = dbPagarmeMap.has(key);
    const invoiceId = ch.invoice?.id;
    const hasInvoiceMatch = invoiceId ? dbPagarmeMap.has(invoiceId.trim().toLowerCase()) : false;

    if (hasDirectMatch || hasInvoiceMatch) {
      matchedCharges++;
    } else {
      missingCharges++;
      missingChargeList.push({
        id: ch.id,
        invoice_id: invoiceId || 'N/A',
        amount: ch.amount / 100,
        paid_at: ch.last_transaction?.success ? ch.last_transaction.created_at : ch.paid_at,
        payment_method: ch.payment_method,
        customer_name: ch.customer?.name,
        customer_email: ch.customer?.email
      });
    }
  }

  console.log(`Charges summary:`);
  console.log(`  - Matched: ${matchedCharges}`);
  console.log(`  - Missing: ${missingCharges}`);

  if (missingChargeList.length > 0) {
    console.log(`Sample of missing charges (first 10):`);
    console.table(missingChargeList.slice(0, 10));
  }
}

run();
