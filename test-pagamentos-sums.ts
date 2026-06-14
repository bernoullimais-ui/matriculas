import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data: pagamentos, error } = await supabase.from('pagamentos')
    .select('valor, status, data_pagamento, data_vencimento, created_at')
    .in('status', ['pago', 'conciliado']);

  if (error) {
    console.log("Error:", error);
    return;
  }

  let totalDashboard = 0;
  let totalFinancialReport = 0;

  const firstDay = '2026-06-01';
  const limitStart = new Date('2026-06-01T00:00:00Z');
  const limitEnd = new Date('2026-06-30T23:59:59Z');

  pagamentos?.forEach(p => {
    // Dashboard Logic
    if (p.data_pagamento && p.data_pagamento >= firstDay) {
      totalDashboard += Number(p.valor);
    }

    // Financial Report Logic
    const payDate = new Date(p.data_vencimento || p.created_at);
    if (payDate >= limitStart && payDate <= limitEnd) {
      totalFinancialReport += Number(p.valor);
    }
  });

  console.log("Total Dashboard (data_pagamento >= 2026-06-01):", totalDashboard);
  console.log("Total Financial Report (data_vencimento in June):", totalFinancialReport);
}

run();
