const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { error } = await supabase.from('alunos').insert([{ id: 'test', responsavel1: 'test' }]);
  console.log('Error:', error);
}
test();
