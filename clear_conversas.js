const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { error } = await supabase.from('conversas_whatsapp').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log(error ? error : "Conversas deletadas com sucesso");
}
run();
