import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function run() {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseServiceKey}`);
    const spec: any = await res.json();
    const tableDef = spec.definitions?.['alunos'];
    if (tableDef) {
      console.log('Properties of alunos:', Object.keys(tableDef.properties));
    } else {
      console.log('alunos definition not found in spec.');
    }
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}
run();
