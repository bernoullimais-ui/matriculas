const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: a } = await supabase.from('alunos').select('*').limit(1);
  const { data: m } = await supabase.from('matriculas').select('*, turmas(*), planos(*)').limit(1);
  console.log('Alunos keys:', Object.keys(a[0] || {}));
  console.log('Matriculas keys:', Object.keys(m[0] || {}));
}
test();
