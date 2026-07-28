import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.rpc('get_conversas_by_unidades', {
    p_allowed_units: ['Todas'],
    p_status: null,
    p_identidade: null,
    p_limit: 1,
    p_offset: 0,
    p_user_id: null,
    p_etiqueta: null
  });
  console.log('RPC result:', data ? Object.keys(data[0] || {}) : error);
}

main();
