import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: inscricao, error } = await supabase
    .from('evento_inscricoes')
    .select('*, eventos(*)')
    .ilike('nome_aluno', '%Pérola%')
    .maybeSingle();
    
  if (error || !inscricao) {
    console.error('Erro ou nao encontrado:', error);
    return;
  }
  
  const targetPhone = inscricao.telefone_responsavel || (inscricao.respostas_personalizadas)?.['WhatsApp do Responsável'];
  const numInscricao = String(inscricao.id).padStart(6, '0');
  const dataEv = new Date(inscricao.eventos.data_inicio);
  const dataFormatada = dataEv.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'long', year: 'numeric' });
  const horaFormatada = dataEv.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  
  const msg = `Olá, ${inscricao.nome_responsavel}!\n` +
    `Sua inscrição no evento *${inscricao.eventos.titulo}* teve o pagamento confirmado com sucesso! 🎉\n\n` +
    `*Detalhes da Inscrição:*\n` +
    `- Código: ${numInscricao}\n` +
    `- Aluno(a): ${inscricao.nome_aluno}\n` +
    `- Categoria: ${inscricao.categoria || 'Geral'}\n\n` +
    `*Detalhes do Evento:*\n` +
    `- Data: ${dataFormatada} às ${horaFormatada}h\n` +
    `- Local: ${inscricao.eventos.local || 'A definir'}\n\n` +
    `Sua participação está garantida! Te esperamos lá!`;
    
  console.log('Sending message to', targetPhone);
  console.log(msg);
  
  const { data, error: fnError } = await supabase.functions.invoke('send-whatsapp', {
    body: {
      toPhone: targetPhone,
      contactName: inscricao.nome_responsavel,
      message: msg,
      unidadeName: inscricao.unidade
    }
  });
  
  console.log('Result:', data, fnError);
}
run();
