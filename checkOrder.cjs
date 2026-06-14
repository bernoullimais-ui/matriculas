const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);
supabase.from('loja_pedidos').select('status').eq('id', '00cab618-deb0-4d5c-b99f-85425da7eeb6').then(res => console.log(res.data));
