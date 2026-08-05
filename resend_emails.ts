import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: notas } = await supabase
    .from('notas_fiscais_fila')
    .select('id, dados_emissao, nfe_numero, nfe_url_pdf, nfe_url_xml')
    .gte('created_at', '2026-08-01T00:00:00Z')
    .eq('status', 'autorizado');

  for (const nota of notas) {
    if (!nota.dados_emissao?.email) continue;
    
    const nomeCliente = nota.dados_emissao.nome || 'Cliente';
    const brevoBody: any = {
      to: [{ email: nota.dados_emissao.email, name: nomeCliente }],
      sender: { name: 'Sport for Kids', email: 'adm@sportforkids.com.br' },
      subject: 'Sua Nota Fiscal de Serviços (NFS-e) foi emitida - Sport for Kids',
      htmlContent: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
          <div style="background-color: #0f172a; padding: 30px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Sport for Kids</h1>
          </div>
          <div style="padding: 40px 30px; color: #334155; line-height: 1.6;">
            <p style="font-size: 16px; margin-top: 0;">Olá, <strong>${nomeCliente}</strong>,</p>
            <p style="font-size: 16px;">Sua Nota Fiscal de Serviços Eletrônica (NFS-e) número <strong>${nota.nfe_numero}</strong> foi emitida com sucesso!</p>
            
            <div style="margin: 40px 0; text-align: center;">
              <a href="${nota.nfe_url_pdf}" style="background-color: #4f46e5; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">
                Acessar PDF da Nota Fiscal
              </a>
            </div>
            
            <p style="font-size: 14px; color: #64748b; margin-bottom: 0;">
              Se preferir, você também pode baixar o arquivo XML clicando <a href="${nota.nfe_url_xml}" style="color: #4f46e5; text-decoration: underline;">aqui</a>.
            </p>
          </div>
          <div style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #f1f5f9;">
            <p style="font-size: 13px; color: #94a3b8; margin: 0;">
              Atenciosamente,<br/><strong style="color: #64748b;">Equipe Sport for Kids</strong>
            </p>
          </div>
        </div>
      `
    };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify(brevoBody)
    });
    
    if (response.ok) {
      console.log(`E-mail reenviado para ${nota.dados_emissao.email}`);
    } else {
      console.log(`Erro ao enviar para ${nota.dados_emissao.email}:`, response.status, await response.text());
    }
  }
}
run();
