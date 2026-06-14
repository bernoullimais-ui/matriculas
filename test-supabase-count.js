const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'http://localhost:54321', 
  process.env.VITE_SUPABASE_ANON_KEY || 'dummy'
);

async function test() {
  const { count } = await supabase.from('pagamentos').select('*', { count: 'exact', head: true });
  console.log('Count:', count);
}
test().catch(console.error);
