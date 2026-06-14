import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

serve(async (req) => {
  // Configuração CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const bucketName = 'whatsapp_media'
    
    // Lista os arquivos na pasta principal do bucket (ou 'anexos' se usamos a subpasta)
    // Nosso upload via React salva em anexos/
    const folder = 'anexos'
    const { data: files, error: listError } = await supabase.storage.from(bucketName).list(folder, {
      limit: 1000,
      offset: 0,
      sortBy: { column: 'created_at', order: 'asc' }
    })

    if (listError) {
      throw listError
    }

    if (!files || files.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum arquivo encontrado para limpar" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const agora = new Date()
    const arquivosParaDeletar = []

    for (const file of files) {
      if (file.name === '.emptyFolderPlaceholder') continue;
      
      const fileDate = new Date(file.created_at)
      const diffHoras = (agora.getTime() - fileDate.getTime()) / (1000 * 60 * 60)
      
      // Deleta se tiver mais de 24 horas
      if (diffHoras >= 24) {
        arquivosParaDeletar.push(`${folder}/${file.name}`)
      }
    }

    if (arquivosParaDeletar.length > 0) {
      const { error: deleteError } = await supabase.storage.from(bucketName).remove(arquivosParaDeletar)
      if (deleteError) {
        throw deleteError
      }
      console.log(`Deletados ${arquivosParaDeletar.length} arquivos antigos.`)
    } else {
      console.log('Nenhum arquivo precisou ser deletado.')
    }

    return new Response(JSON.stringify({
      message: "Cleanup executado com sucesso",
      removidos: arquivosParaDeletar.length
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})
