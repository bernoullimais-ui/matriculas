import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

async function check() {
  const { data: wix } = await supabase.from('pagamentos_wix').select('*');
  if (!wix) return;

  const dateCounts: Record<string, number> = {};
  
  wix.forEach(w => {
    let dateStr = String(w.data_pagamento_gmt_03 || w.created_at);
    let yearMonth = dateStr.substring(0, 7); // yyyy-mm
    if (dateStr.includes('/')) {
      const parts = dateStr.split(' ')[0].split('/');
      if (parts.length === 3) {
        let year = parts[2];
        if (year.length === 2) year = `20${year}`;
        let month = parts[1].padStart(2, '0');
        yearMonth = `${year}-${month}`;
      }
    }
    dateCounts[yearMonth] = (dateCounts[yearMonth] || 0) + 1;
  });

  console.log('Wix payments count by Year-Month:', dateCounts);
}

check();
