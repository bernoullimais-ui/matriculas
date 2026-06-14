import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { toEmail, toName, subject, htmlContent, attachments, unidadeName } = await req.json()

    if (!toEmail || !subject || !htmlContent) {
      throw new Error("Email, subject and htmlContent are required")
    }

    const apiKey = Deno.env.get("BREVO_API_KEY");
    if (!apiKey) {
      throw new Error("BREVO_API_KEY is not configured");
    }

    let senderName = "Sport for Kids";
    let senderEmail = "adm@sportforkids.com.br";

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    if (unidadeName) {
      try {
        const { data: mappingData } = await supabaseClient
          .from('unidades_mapping')
          .select('identidade')
          .eq('nome', unidadeName.trim())
          .maybeSingle();
        
        let identidadeName = mappingData?.identidade;
        
        if (!identidadeName) {
          const { data: fallbackMapping } = await supabaseClient
            .from('unidades_mapping')
            .select('identidade')
            .eq('nome_unidade', unidadeName.trim())
            .maybeSingle();
          identidadeName = fallbackMapping?.identidade;
        }

        if (identidadeName) {
          const { data: idData } = await supabaseClient
            .from('identidades')
            .select('nome_remetente, email_remetente')
            .eq('nome', identidadeName)
            .maybeSingle();
          
          if (idData) {
            if (idData.nome_remetente) senderName = idData.nome_remetente;
            if (idData.email_remetente) senderEmail = idData.email_remetente;
          }
        }
      } catch (err) {
        console.warn("[Email Edge] Error fetching identity credentials, using defaults:", err);
      }
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: toEmail, name: toName || 'Cliente' }],
        subject: subject,
        htmlContent: htmlContent,
        attachment: attachments
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Brevo API error: ${JSON.stringify(errorData)}`);
    }

    return new Response(
      JSON.stringify({ success: true, email: toEmail }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
