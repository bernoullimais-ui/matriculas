const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const connString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!connString) {
    console.log("No DB URL found");
    // let's try to parse from SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY? No, we need a postgres:// connection string.
    return;
  }
  const client = new Client({ connectionString: connString });
  await client.connect();
  try {
    await client.query("ALTER TABLE campaign_landing_pages ADD COLUMN IF NOT EXISTS cupom_id UUID REFERENCES cupons(id);");
    console.log("Success");
  } catch (err) {
    console.log("Error:", err);
  } finally {
    await client.end();
  }
}
run();
