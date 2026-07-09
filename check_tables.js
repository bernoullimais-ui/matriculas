const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join('/Users/brunomaia/Developer/matrícula-online-sport-for-kids', '.env') });

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // Let's query public.unidades table
  const { data: units, error } = await supabase
    .from('unidades')
    .select('*')
    .limit(10);

  if (error) {
    console.error("Error querying 'unidades':", error);
    
    // Check if table exists by querying supabase pg_tables if possible, or just print schema
    const { data: tables, error: tablesErr } = await supabase
      .from('unidades_mapping')
      .select('*')
      .limit(5);
    console.log("unidades_mapping table:", tables);
    return;
  }
  console.log("unidades table exists. Sample rows:", units);
}

run();
