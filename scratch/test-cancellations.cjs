require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkCancellations() {
  const now = new Date();
  const firstDayOfMonthIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  
  // Create YYYY-MM-DD format for string comparisons if data is stored like that
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const firstDayOfMonthStr = `${year}-${month}-01`;

  console.log('firstDayOfMonthIso:', firstDayOfMonthIso);
  console.log('firstDayOfMonthStr:', firstDayOfMonthStr);

  const { data: cancelamentosData1 } = await supabase.from('matriculas')
    .select('id, data_cancelamento, status')
    .gte('data_cancelamento', firstDayOfMonthIso);

  const { data: cancelamentosData2 } = await supabase.from('matriculas')
    .select('id, data_cancelamento, status')
    .gte('data_cancelamento', firstDayOfMonthStr);

  console.log('Using Iso Date:', cancelamentosData1?.length);
  console.log('Using Str Date:', cancelamentosData2?.length);
  
  if (cancelamentosData2) {
    console.log(cancelamentosData2.map(c => `${c.data_cancelamento} - ${c.status}`));
  }
}

checkCancellations().catch(console.error);
