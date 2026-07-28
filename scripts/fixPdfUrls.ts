import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function run() {
  const { data: notas } = await supabase.from('notas_fiscais_fila')
    .select('*')
    .eq('status', 'autorizado')
    .like('nfe_url_pdf', '%focusnfe%');

  if (!notas) return;

  const tokenAuth = Buffer.from(`${process.env.FOCUS_NFE_API_TOKEN}:`).toString('base64');
  
  for (const nota of notas) {
    if (nota.nfe_url_xml) {
      try {
        const resp = await axios.get(nota.nfe_url_xml, {
          headers: { 'Authorization': `Basic ${tokenAuth}` }
        });
        const match = resp.data.match(/<CodigoVerificacao>([^<]+)<\/CodigoVerificacao>/);
        if (match && match[1]) {
           const cod = match[1];
           const prefeitura = process.env.FOCUS_NFE_API_URL?.includes('homologacao') ? 'notahml' : 'nota';
           const newUrl = `https://${prefeitura}.salvador.ba.gov.br/site/contribuinte/nota/notaprint.aspx?nf=${nota.nfe_numero}&inscricao=0012734900199&verificacao=${cod}`;
           console.log(`Fixing ${nota.id}: ${newUrl}`);
           await supabase.from('notas_fiscais_fila').update({ nfe_url_pdf: newUrl }).eq('id', nota.id);
        }
      } catch(e: any) {
        console.error("Error for " + nota.id + ": " + e.message);
      }
    }
  }
}
run();
