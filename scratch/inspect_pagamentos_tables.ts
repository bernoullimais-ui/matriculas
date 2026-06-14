import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function inspect() {
  console.log('--- Inspecting pagamentos table ---');
  const { data: pagamentos, error } = await supabase
    .from('pagamentos')
    .select('id, metodo_pagamento, pagarme, status, valor, created_at')
    .limit(10);

  if (error) {
    console.error('Error fetching from pagamentos:', error);
  } else {
    console.log(`Fetched ${pagamentos?.length} sample records from pagamentos:`);
    console.log(JSON.stringify(pagamentos, null, 2));
  }

  const { data: pagCount, error: countError } = await supabase
    .from('pagamentos')
    .select('metodo_pagamento, status', { count: 'exact', head: true });

  console.log('pagamentos count error:', countError);

  // Group by metodo_pagamento in pagamentos
  const { data: grouping, error: groupError } = await supabase
    .from('pagamentos')
    .select('id, metodo_pagamento, status, pagarme');

  if (grouping) {
    const counts: { [key: string]: number } = {};
    const methods: { [key: string]: string[] } = {};
    const statusCounts: { [key: string]: number } = {};
    const pagarmeNullCounts = { null: 0, notNull: 0 };
    
    for (const p of grouping) {
      const met = p.metodo_pagamento || 'null';
      counts[met] = (counts[met] || 0) + 1;
      
      const st = p.status || 'null';
      statusCounts[st] = (statusCounts[st] || 0) + 1;

      if (p.pagarme) {
        pagarmeNullCounts.notNull++;
      } else {
        pagarmeNullCounts.null++;
      }
    }
    console.log('Grouping by metodo_pagamento:', counts);
    console.log('Grouping by status:', statusCounts);
    console.log('Pagarme ID field:', pagarmeNullCounts);
  }
}

inspect();
