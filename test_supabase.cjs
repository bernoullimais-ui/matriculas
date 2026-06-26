const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.from('alunos').select('nome_completo, whatsapp_1').or('whatsapp_1.ilike.*99141*');
  console.log('With *:', data?.length);
  const { data: data2 } = await supabase.from('alunos').select('nome_completo, whatsapp_1').or('whatsapp_1.ilike.%99141%');
  console.log('With %:', data2?.length);
}
run();
