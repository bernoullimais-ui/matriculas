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

    // 2. Buscar professor da turma (campo texto livre para comparação de fallback)
    const { data: turma } = await supabase
      .from('turmas')
      .select('professor')
      .eq('nome', record.turma)
      .maybeSingle();

    const professorTurma = turma?.professor || null;

    // 3. Buscar destinatários com notificacoes_ativas = true e whatsapp preenchido
    const { data: destinatarios } = await supabase
      .from('usuarios')
      .select('nome, login, whatsapp, unidade, nivel, notificacoes_ativas')
      .eq('notificacoes_ativas', true)
      .not('whatsapp', 'is', null);

    // 4. Filtrar destinatários:
    //    a) Gestores Master/Global (acesso irrestrito)
    //    b) Professor da turma: nome do usuário bate com o campo turmas.professor (case-insensitive)
    const alvos = (destinatarios || []).filter((u: any) => {
      if (!u.whatsapp) return false;

      const unidadesUsuario = (u.unidade || '').split(',').map((x: string) => x.trim());
      const nivelLower = (u.nivel || '').toLowerCase();

      // Verificar se o usuário é master/global (acesso irrestrito)
      const isMaster = nivelLower.includes('master') ||
                       nivelLower.includes('start') ||
                       u.unidade === 'todas' ||
                       unidadesUsuario.includes('todas');

      if (isMaster) return true;

      // Professor da turma: comparar nome do usuário com campo turmas.professor (case-insensitive + trim)
      const ehProfessorDaTurma = professorTurma &&
        u.nome?.toLowerCase().trim() === professorTurma.toLowerCase().trim();

      return ehProfessorDaTurma;
    });

    // 5. Buscar identidade "Sport for Kids" (ou fallback para a primeira)
    const { data: identidades } = await supabase
      .from('identidades')
      .select('nome, utalk_token, utalk_from_phone, utalk_organization_id');

    const identidade = (identidades || []).find((i: any) =>
      i.nome?.toLowerCase().includes('sport for kids')
    ) || (identidades || [])[0];

    if (!identidade?.utalk_token) {
      console.warn('[notify-staff] Nenhuma identidade válida encontrada.');
      return new Response(JSON.stringify({ notified: 0, reason: 'no identity' }), { status: 200, headers: corsHeaders });
    }

    const mensagem =
      `[ALERTA Gestão Sport for Kids]\n\n` +
      `✅ *Nova Matrícula*\n` +
      `Aluno: ${aluno?.nome_completo || record.aluno_nome || '—'}\n` +
      `Unidade: ${record.unidade || '—'}\n` +
      `Turma: ${record.turma || '—'}\n` +
      `Data: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n` +
      `Plano: ${record.plano || '—'}\n` +
      `Responsável: ${aluno?.responsavel1 || '—'}`;

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
