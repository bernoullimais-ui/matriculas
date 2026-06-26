require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const telNorm = '71991414913';
  const wildcardTel = '*' + telNorm.split('').join('*') + '*';
  console.log('wildcardTel:', wildcardTel);

  const { data: alunos, error } = await supabase
    .from('alunos')
    .select('id, nome_completo, whatsapp_1, whatsapp_2')
    .or(
      `whatsapp_1.ilike.${wildcardTel},whatsapp_2.ilike.${wildcardTel}`
    )
    .limit(10);
  
  console.log('Alunos:', alunos, 'Error:', error);
}
run();
