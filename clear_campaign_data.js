const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join('/Users/brunomaia/Developer/matrícula-online-sport-for-kids', '.env') });

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Searching for campaign 'Aniversariantes (Jul/26)'...");
  
  const { data: campaign, error: cErr } = await supabase
    .from('campaigns')
    .select('id, nome, slug')
    .ilike('nome', '%Aniversariantes (Jul/26)%')
    .single();

  if (cErr || !campaign) {
    console.error("Campaign not found:", cErr?.message || "No results");
    
    // Fallback: list all campaigns just in case
    const { data: all } = await supabase.from('campaigns').select('id, nome');
    console.log("Available campaigns:", all);
    return;
  }

  console.log(`Found campaign: ${campaign.nome} (ID: ${campaign.id})`);

  // 1. Zero out metrics
  console.log("Zeroing out campaign metrics...");
  const { error: mErr } = await supabase
    .from('campaign_metrics')
    .update({
      emails_enviados: 0,
      emails_entregues: 0,
      emails_abertos: 0,
      cliques: 0,
      visitas_lp: 0,
      leads_gerados: 0,
      matriculas: 0,
      valor_gerado: 0
    })
    .eq('campaign_id', campaign.id);
    
  if (mErr) console.error("Error updating metrics:", mErr);
  else console.log("Metrics zeroed successfully.");

  // 2. Delete logs
  console.log("Deleting campaign logs...");
  const { error: lErr } = await supabase
    .from('campaign_logs')
    .delete()
    .eq('campaign_id', campaign.id);

  if (lErr) console.error("Error deleting logs:", lErr);
  else console.log("Logs deleted successfully.");
}

run();
