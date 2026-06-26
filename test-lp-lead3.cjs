const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const res = await supabase.from('alunos').insert([{
        nome_completo: "Test Lead",
        unidade: 'SEM UNIDADE',
        responsavel_1: "Test Resp",
        email: "test@test.com",
        whatsapp_1: "3199999999",
        status_matricula: 'lead',
        is_lead: true,
        created_at: new Date().toISOString(),
      }]);
  console.log("Error:", res.error);
}
run();
