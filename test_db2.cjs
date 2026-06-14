const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDuplicates() {
  const { data: wixData } = await supabase.from('pagamentos_wix').select('*').limit(2000);
  
  const sigs = new Map();
  for (const w of wixData) {
    if (!w.aluno_id) continue;
    const monthYear = new Date(w.data_pagamento_gmt_03 || w.created_at).toISOString().substring(0, 7);
    const sig = `${w.aluno_id}-${monthYear}-${w.valor}`;
    
    if (!sigs.has(sig)) {
      sigs.set(sig, []);
    }
    sigs.get(sig).push({ id: w.id, id_prov: w.id_provedor_pagamento, prov: w.provedor_pagamento });
  }
  
  let printed = 0;
  for (const [sig, records] of sigs.entries()) {
    if (records.length > 1) {
      console.log(`Duplicates for ${sig}:`);
      console.log(records);
      printed++;
      if (printed > 5) break;
    }
  }
}

checkDuplicates();
