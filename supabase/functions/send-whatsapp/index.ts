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
    const { toPhone, contactName, message, unidadeName } = await req.json()

    if (!toPhone || !message) {
      throw new Error("Phone and message are required")
    }

    let utalkToken = Deno.env.get("UTALK_TOKEN") || "sfk-api-token-2026-03-12-2094-03-30--47482FB3C78CF7D176AB52761A3374A558374940DE977AD9EB7F5EE12163C662"
    let utalkFrom = Deno.env.get("UTALK_FROM_PHONE") || "+557130457777"
    let utalkOrgId = Deno.env.get("UTALK_ORGANIZATION_ID") || "aZhaeS9bnyeDpiMs"
    const utalkUrl = Deno.env.get("UTALK_URL") || "https://app-utalk.umbler.com/api/v1/messages/simplified/"

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
            .select('utalk_token, utalk_from_phone, utalk_organization_id')
            .eq('nome', identidadeName)
            .maybeSingle();
          
          if (idData) {
            if (idData.utalk_token) utalkToken = idData.utalk_token;
            if (idData.utalk_from_phone) utalkFrom = idData.utalk_from_phone;
            if (idData.utalk_organization_id) utalkOrgId = idData.utalk_organization_id;
          }
        }
      } catch (err) {
        console.warn("[WhatsApp Edge] Error fetching identity credentials, using defaults:", err);
      }
    }

    let phone = toPhone.replace(/\D/g, '');
    if (phone.startsWith('0')) phone = phone.substring(1);
    if (phone.length === 11 || phone.length === 10) phone = '55' + phone;
    if (!phone.startsWith('+')) phone = '+' + phone;

    const response = await fetch(utalkUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${utalkToken}`
      },
      body: JSON.stringify({
        toPhone: phone,
        fromPhone: utalkFrom,
        organizationId: utalkOrgId,
        message: message,
        contactName: contactName || 'Cliente'
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`UTalk API Error: ${JSON.stringify(errorData)}`);
    }

    return new Response(
      JSON.stringify({ success: true, phone }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
