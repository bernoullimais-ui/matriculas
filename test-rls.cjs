const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function test() {
  const { data: alunos, error } = await supabase.from('alunos').select('id');
  console.log('Alunos with anon key:', alunos ? alunos.length : null, 'Error:', error);
}
test();
