import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Map webhook types to notify Movimentacao
type TipoMovimentacao = 'experimental' | 'matricula' | 'transferencia' | 'cancelamento';

interface NotifyParams {
  tipo: TipoMovimentacao;
  alunoNome: string;
  unidade: string;
  turma?: string;
  turmaNova?: string;
  turmaAnterior?: string;
  horarioTurma?: string;
  horarioTurmaNova?: string;
  horarioTurmaAnterior?: string;
  professorTurma?: string;
  data: string;
  horario?: string;
  responsavel?: string;
  whatsappResponsavel?: string;
  plano?: string;
}

function formatTurmaComHorario(nomeTurma?: string, horario?: string): string {
  if (!nomeTurma) return '—';
  if (!horario || !horario.trim()) return nomeTurma;
  if (nomeTurma.includes('(') && nomeTurma.includes(')')) return nomeTurma;
  return `${nomeTurma} (${horario.trim()})`;
}

function buildMessage(params: NotifyParams): string {
  const emojis: Record<TipoMovimentacao, string> = {
    experimental: '🧪', matricula: '✅',
    transferencia: '🔄', cancelamento: '⚠️'
  };
  const labels: Record<TipoMovimentacao, string> = {
    experimental: 'Novo Experimental Agendado',
    matricula: 'Nova Matrícula',
    transferencia: 'Transferência de Turma',
    cancelamento: 'Cancelamento de Matrícula'
  };

  const header = `${emojis[params.tipo]} *${labels[params.tipo]}*\n`;

  switch (params.tipo) {
    case 'experimental':
      return header +
        `Aluno: ${params.alunoNome}\n` +
        `Unidade: ${params.unidade}\n` +
        `Turma: ${formatTurmaComHorario(params.turma, params.horarioTurma)}\n` +
        `Data: ${params.data}${params.horario ? ` às ${params.horario}` : ''}\n` +
        `Responsável: ${params.responsavel || '—'} | ${params.whatsappResponsavel || '—'}`;

    case 'matricula':
      return header +
        `Aluno: ${params.alunoNome}\n` +
        `Unidade: ${params.unidade}\n` +
        `Turma: ${formatTurmaComHorario(params.turma, params.horarioTurma)}\n` +
        `Data: ${params.data}\n` +
        `Plano: ${params.plano || '—'}\n` +
        `Responsável: ${params.responsavel || '—'}`;

    case 'transferencia':
      return header +
        `Aluno: ${params.alunoNome}\n` +
        `Unidade: ${params.unidade}\n` +
        `De: ${formatTurmaComHorario(params.turmaAnterior, params.horarioTurmaAnterior)}\n` +
        `Para: ${formatTurmaComHorario(params.turmaNova, params.horarioTurmaNova)}\n` +
        `Data: ${params.data}`;

    case 'cancelamento':
      return header +
        `Aluno: ${params.alunoNome}\n` +
        `Unidade: ${params.unidade}\n` +
        `Turma: ${formatTurmaComHorario(params.turma, params.horarioTurma)}\n` +
        `Data Efetiva de Cancelamento (frequenta até): ${params.data}`;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json();
    console.log("Webhook payload received:", body);

    const { type, table, record, old_record } = body;
    if (!type || !table || !record) {
      throw new Error("Invalid webhook payload format");
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    let notifyParams: NotifyParams | null = null;
    let responsavelNome = '';
    let alunoNome = '';

    // Helpers to fetch related names
    const getAlunoNome = async (alunoId: string) => {
      const { data } = await supabaseClient.from('alunos').select('nome_completo, responsavel_id').eq('id', alunoId).single();
      return data;
    }

    const getResponsavel = async (responsavelId: string) => {
      const { data } = await supabaseClient.from('responsaveis').select('nome_completo, telefone').eq('id', responsavelId).single();
      return data;
    }

    if (table === 'matriculas') {
      const alunoData = await getAlunoNome(record.aluno_id);
      alunoNome = alunoData?.nome_completo || 'Aluno não encontrado';
      
      if (alunoData?.responsavel_id) {
        const respData = await getResponsavel(alunoData.responsavel_id);
        responsavelNome = respData?.nome_completo || '';
      }

      const status = (record.status || '').toLowerCase();
      const oldStatus = old_record ? (old_record.status || '').toLowerCase() : '';

      if (type === 'INSERT') {
        notifyParams = {
          tipo: 'matricula',
          alunoNome,
          unidade: record.unidade,
          turma: record.turma,
          data: record.data_matricula || record.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
          plano: record.plano,
          responsavel: responsavelNome
        };
      } else if (type === 'UPDATE') {
        if (status === 'cancelado' && oldStatus !== 'cancelado') {
          notifyParams = {
            tipo: 'cancelamento',
            alunoNome,
            unidade: record.unidade,
            turma: record.turma,
            data: record.data_cancelamento || new Date().toISOString().split('T')[0]
          };
        } else if (record.turma_id && old_record && record.turma_id !== old_record.turma_id && old_record.turma_id) {
          notifyParams = {
            tipo: 'transferencia',
            alunoNome,
            unidade: record.unidade,
            turmaNova: record.turma,
            turmaAnterior: old_record.turma,
            data: record.data_matricula || new Date().toISOString().split('T')[0]
          };
        }
      }
    } else if (table === 'aulas_experimentais' && type === 'INSERT') {
      const alunoData = await getAlunoNome(record.aluno_id);
      alunoNome = alunoData?.nome_completo || 'Aluno não encontrado';

      notifyParams = {
        tipo: 'experimental',
        alunoNome,
        unidade: record.unidade,
        turma: record.turma_escolar || record.curso,
        data: record.aula,
        horario: record.horario,
        responsavel: record.responsavel1,
        whatsappResponsavel: record.whatsapp1
      };
    }

    if (!notifyParams) {
      return new Response(JSON.stringify({ message: "No relevant change detected, ignoring." }), { headers: corsHeaders });
    }

    // Determine turmas schedules and professor
    const turmasBuscadas = [notifyParams.turma, notifyParams.turmaNova, notifyParams.turmaAnterior].filter(Boolean) as string[];
    let professorTurma = '';
    if (turmasBuscadas.length > 0) {
      const { data: turmasData } = await supabaseClient.from('turmas').select('nome, professor, dias_horarios').in('nome', turmasBuscadas);
      if (turmasData && turmasData.length > 0) {
        if (notifyParams.turma) {
          const t = turmasData.find(x => x.nome?.toLowerCase().trim() === notifyParams.turma?.toLowerCase().trim());
          if (t?.dias_horarios) notifyParams.horarioTurma = t.dias_horarios;
          if (t?.professor) professorTurma = t.professor;
        }
        if (notifyParams.turmaNova) {
          const t = turmasData.find(x => x.nome?.toLowerCase().trim() === notifyParams.turmaNova?.toLowerCase().trim());
          if (t?.dias_horarios) notifyParams.horarioTurmaNova = t.dias_horarios;
          if (t?.professor && !professorTurma) professorTurma = t.professor;
        }
        if (notifyParams.turmaAnterior) {
          const t = turmasData.find(x => x.nome?.toLowerCase().trim() === notifyParams.turmaAnterior?.toLowerCase().trim());
          if (t?.dias_horarios) notifyParams.horarioTurmaAnterior = t.dias_horarios;
        }
      }
    }

    // Get units identity
    let identidadeName = 'Sport for Kids';
    const { data: mappingData } = await supabaseClient.from('unidades_mapping').select('identidade').eq('nome', notifyParams.unidade.trim()).maybeSingle();
    
    if (mappingData?.identidade) {
      identidadeName = mappingData.identidade;
    } else {
      const { data: fallbackMapping } = await supabaseClient.from('unidades_mapping').select('identidade').eq('nome_unidade', notifyParams.unidade.trim()).maybeSingle();
      if (fallbackMapping?.identidade) identidadeName = fallbackMapping.identidade;
    }

    // Get identity credentials
    let utalkToken = Deno.env.get("UTALK_TOKEN") || "sfk-api-token-2026-03-12-2094-03-30--47482FB3C78CF7D176AB52761A3374A558374940DE977AD9EB7F5EE12163C662"
    let utalkFrom = Deno.env.get("UTALK_FROM_PHONE") || "+557130457777"
    let utalkOrgId = Deno.env.get("UTALK_ORGANIZATION_ID") || "aZhaeS9bnyeDpiMs"
    const utalkUrl = Deno.env.get("UTALK_URL") || "https://app-utalk.umbler.com/api/v1/messages/simplified/"

    const { data: idData } = await supabaseClient.from('identidades').select('*').eq('nome', identidadeName).maybeSingle();
    if (idData) {
      if (idData.utalk_token) utalkToken = idData.utalk_token;
      if (idData.utalk_from_phone) utalkFrom = idData.utalk_from_phone;
      if (idData.utalk_organization_id) utalkOrgId = idData.utalk_organization_id;
    }

    // Get users to notify
    let destinatarios: any[] = [];
    const { data: rpcUsuarios } = await supabaseClient.rpc('get_notificacoes_destinatarios', { p_unidade: notifyParams.unidade });
    if (rpcUsuarios && rpcUsuarios.length > 0) {
      destinatarios = rpcUsuarios;
    } else {
      const { data: usuarios } = await supabaseClient.from('usuarios').select('*');
      if (usuarios) destinatarios = usuarios;
    }

    const paramUnidadeNorm = (notifyParams.unidade || '').trim().toLowerCase();
    const finalDestinatarios = destinatarios.filter((u: any) => {
      if (u.notificacoes_ativas === false) return false;
      if (!u.whatsapp) return false;

      const unidades = (u.unidade || '').split(',').map((x: string) => x.trim().toLowerCase());
      const vinculadoUnidade = u.unidade?.toLowerCase() === 'todas' || unidades.includes(paramUnidadeNorm);
      const ehProfessorDaTurma = professorTurma && u.nome?.toLowerCase().trim() === professorTurma.toLowerCase().trim();

      const nivel = (u.nivel || '').toLowerCase();
      if (nivel === 'professor') {
        return ehProfessorDaTurma;
      }

      return vinculadoUnidade || ehProfessorDaTurma;
    });

    const mensagem = buildMessage(notifyParams);

    for (const dest of finalDestinatarios) {
      let phone = dest.whatsapp.replace(/\D/g, '');
      if (phone.startsWith('0')) phone = phone.substring(1);
      if (phone.length === 11 || phone.length === 10) phone = '55' + phone;
      if (!phone.startsWith('+')) phone = '+' + phone;

      try {
        const response = await fetch(utalkUrl, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${utalkToken}`,
            'token': utalkToken,
            'x-token': utalkToken
          },
          body: JSON.stringify({
            toPhone: phone,
            fromPhone: utalkFrom,
            organizationId: utalkOrgId,
            message: `*[ALERTA Gestão Sport for Kids]*\n\n${mensagem}`,
            contactName: dest.nome || 'Equipe'
          })
        });

        const ok = response.ok;
        await supabaseClient.from('notificacoes_log').insert({
          tipo: notifyParams.tipo,
          aluno_nome: notifyParams.alunoNome,
          unidade: notifyParams.unidade,
          turma: turmaNome || null,
          destinatario_nome: dest.nome || dest.login,
          destinatario_whatsapp: dest.whatsapp,
          mensagem: mensagem,
          status: ok ? 'enviado' : 'erro'
        });
      } catch (err) {
        console.error("Error sending WhatsApp to", dest.nome, err);
      }
    }

    return new Response(JSON.stringify({ success: true, notifiedCount: finalDestinatarios.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})
