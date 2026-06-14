import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: wix } = await supabase.from('pagamentos_wix').select('*');
  if (!wix) {
    console.log('No Wix payments found');
    return;
  }
  
  console.log(`Total Wix payments: ${wix.length}`);
  
  const statusCounts: Record<string, number> = {};
  wix.forEach(w => {
    const s = String(w.status_transacao);
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });
  console.log('Wix transaction statuses:', statusCounts);

  // Let's filter by the date window 01/06/2026 to 30/06/2026
  const limitStart = new Date('2026-06-01');
  const limitEnd = new Date('2026-06-30T23:59:59Z');
  
  let inPeriod = 0;
  let inPeriodPaid = 0;
  wix.forEach(w => {
    let dataVenc = (w.data_pagamento_gmt_03 && w.data_pagamento_gmt_03.trim()) || w.created_at;
    if (typeof dataVenc === 'string' && dataVenc.includes('/')) {
      const datePart = dataVenc.split(' ')[0];
      const parts = datePart.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        let year = parts[2];
        if (year.length === 2) year = `20${year}`;
        dataVenc = `${year}-${month}-${day}T12:00:00Z`;
      }
    }
    const payDate = new Date(dataVenc);
    if (payDate >= limitStart && payDate <= limitEnd) {
      inPeriod++;
      const isPaid = (w.status_transacao || '').toLowerCase().includes('bem-sucedido') || 
                     (w.status_transacao || '').toLowerCase() === 'pago';
      if (isPaid) inPeriodPaid++;
    }
  });
  console.log(`In June 2026 period: Total = ${inPeriod}, Paid = ${inPeriodPaid}`);
}

check();
