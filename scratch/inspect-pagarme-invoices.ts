import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import axios from 'axios';

// Load both .env and .env.production
dotenv.config();
dotenv.config({ path: '.env.production' });

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const PAGARME_SECRET_KEY = process.env.PAGARME_SECRET_KEY;
if (!PAGARME_SECRET_KEY) {
  console.error("PAGARME_SECRET_KEY is not defined in environment variables.");
  process.exit(1);
}
const authHeader = Buffer.from(`${PAGARME_SECRET_KEY}:`).toString('base64');

async function inspect() {
  console.log("=== INSPECTING UNMATCHED PAGAR.ME INVOICES ===");
  try {
    const response = await axios.get(`https://api.pagar.me/core/v5/invoices?size=30`, {
      headers: { 'Authorization': `Basic ${authHeader}` }
    });

    const invoices = response.data.data || [];
    console.log(`Fetched ${invoices.length} invoices from Pagar.me API.`);

    for (const invoice of invoices) {
      const invoiceId = invoice.id;
      const subId = invoice.subscription?.id || invoice.subscription_id;
      const status = invoice.status;
      const customerName = invoice.customer?.name || "No name";
      const customerEmail = invoice.customer?.email || "No email";
      const items = invoice.items || [];

      if (!subId) continue;

      // Check database matches
      const { data: matBySub } = await supabase
        .from('matriculas')
        .select('id, status, aluno_id')
        .eq('pagarme_subscription_id', subId)
        .maybeSingle();

      if (!matBySub) {
        console.log(`\n--------------------------------------------`);
        console.log(`Unmatched Invoice: ${invoiceId}`);
        console.log(`Customer: ${customerName} (${customerEmail})`);
        console.log(`Subscription ID: ${subId}`);
        console.log(`API Status: ${status}`);
        console.log(`Items:`, items.map((it: any) => ({
          description: it.description,
          amount: it.amount / 100
        })));

        // Let's check if the customer email matches a responsible in our database
        const { data: resp } = await supabase
          .from('responsaveis')
          .select('id, nome_completo')
          .ilike('email', customerEmail.trim());

        if (resp && resp.length > 0) {
          console.log(`  -> Found matching responsible in DB: ${resp[0].nome_completo} (${resp[0].id})`);
          
          // Let's get the students for this responsible
          const { data: students } = await supabase
            .from('alunos')
            .select('id, nome_completo')
            .eq('responsavel_id', resp[0].id);

          console.log(`     Students in DB for this parent:`, students?.map(s => s.nome_completo));
        } else {
          console.log(`  -> NO matching responsible found for email ${customerEmail}`);
        }
      }
    }

  } catch (error: any) {
    console.error("Error inspecting:", error.response?.data || error.message);
  }
}

inspect();
