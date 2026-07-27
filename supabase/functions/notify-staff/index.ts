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
    const body = await req.json();
    // Body can come from Database Webhook (has `record`) or direct call
    const record = body.record || body;

    if (!record || !record.aluno_id) {
      return new Response(JSON.stringify({ error: 'No record provided' }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Buscar dados do aluno
    const { data: aluno } = await supabase
      .from('alunos')
      .select('nome_completo, responsavel1, whatsapp1')
      .eq('id', record.aluno_id)
      .maybeSingle();

    // 2. Buscar professor da turma
    const { data: turma } = await supabase
      .from('turmas')
      .select('professor')
      .eq('nome', record.turma)
      .maybeSingle();

    const professorTurma = turma?.professor;

    // 3. Buscar destinatários com notificacoes_ativas = true
    const { data: destinatarios } = await supabase
      .from('usuarios')
      .select('nome, login, whatsapp, unidade, nivel, notificacoes_ativas')
      .eq('notificacoes_ativas', true)
      .not('whatsapp', 'is', null);

    // 4. Filtrar: vinculados à unidade OU professor da turma
    const alvos = (destinatarios || []).filter((u: any) => {
      if (!u.whatsapp) return false;
      const unidades = (u.unidade || '').split(',').map((x: string) => x.trim());
      const vinculado = u.unidade === 'todas' || unidades.includes(record.unidade);
      const ehProf = professorTurma &&
        u.nome?.toLowerCase().trim() === professorTurma.toLowerCase().trim();
      return vinculado || ehProf;
    });

    // 5. Buscar identidade "Notificações Internas"
    const { data: identidades } = await supabase
      .from('identidades')
      .select('nome, utalk_token, utalk_from_phone, utalk_organization_id');

    const identidade = (identidades || []).find((i: any) =>
      i.nome?.toLowerCase().includes('notifica') &&
      i.nome?.toLowerCase().includes('interna')
    );

    if (!identidade?.utalk_token) {
      console.warn('[notify-staff] Identidade "Notificações Internas" não encontrada.');
      return new Response(JSON.stringify({ notified: 0, reason: 'no identity' }), { status: 200, headers: corsHeaders });
    }

    const mensagem = `✅ *Nova Matrícula*\nAluno: ${aluno?.nome_completo || '\u2014'}\nUnidade: ${record.unidade}\nTurma: ${record.turma || '\u2014'}\nPlano: ${record.plano || '\u2014'}\nRespensável: ${aluno?.responsavel1 || '\u2014'}`;

    let notified = 0;
    // 6. Enviar e logar para cada destinatário
    for (const dest of alvos) {
      let phone = (dest.whatsapp || '').replace(/\D/g, '');
      if (!phone.startsWith('55')) phone = '55' + phone;

      const res = await fetch('https://app-utalk.umbler.com/api/v1/messages/simplified/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${identidade.utalk_token}`,
          'token': identidade.utalk_token,
          'x-token': identidade.utalk_token
        },
        body: JSON.stringify({
          toPhone: '+' + phone,
          fromPhone: identidade.utalk_from_phone,
          organizationId: identidade.utalk_organization_id,
          message: mensagem
        })
      });

      await supabase.from('notificacoes_log').insert({
        tipo: 'matricula',
        aluno_nome: aluno?.nome_completo,
        unidade: record.unidade,
        turma: record.turma,
        destinatario_nome: dest.nome || dest.login,
        destinatario_whatsapp: dest.whatsapp,
        mensagem,
        status: res.ok ? 'enviado' : 'erro'
      });

      if (res.ok) notified++;
    }

    return new Response(
      JSON.stringify({ notified, total_alvos: alvos.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[notify-staff] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
})
