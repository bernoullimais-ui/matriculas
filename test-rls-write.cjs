const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.from('campaign_sends').insert([{
      campaign_id: '4f77e175-99d8-4815-8d5c-5ceafa719672',
      email_dest: 'test@test.com',
      nome_dest: 'Test',
      status: 'enviado'
  }]).select();
  console.log('Insert with anon key:', data, 'Error:', error);
}
test();
