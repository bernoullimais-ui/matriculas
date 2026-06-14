import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const url = 'http://localhost:3000/api/admin/loja/produtos/4b2b3f17-814b-4c13-824f-2a88562350c0/kit-itens';
  // Let's test by making a direct call to Supabase since we can't easily fetch localhost if the server isn't running in this terminal.
  // Wait, let's check Supabase client query.
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  const { data, error } = await supabase
    .from('loja_kit_itens')
    .select('*')
    .eq('kit_produto_id', '4b2b3f17-814b-4c13-824f-2a88562350c0');

  console.log('Result:', data, 'Error:', error);
}

main().catch(console.error);
