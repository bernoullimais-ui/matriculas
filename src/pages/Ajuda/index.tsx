import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, HelpCircle, ArrowLeft, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useFranquiaTheme } from '../../hooks/useFranquiaTheme';

const tutoriais = [
  {
    id: 'aula-experimental',
    titulo: 'Agendamento de Aula Experimental',
    icone: '✨',
    passos: [
      'Acesse a tela inicial do nosso sistema.',
      'Role a tela para baixo até encontrar as unidades disponíveis e os botões "Agendar Aula Experimental".',
      'Escolha a unidade mais próxima ou do seu interesse e clique no botão.',
      'Você será redirecionado para o WhatsApp da unidade para combinar o melhor dia e horário diretamente com a nossa equipe.'
    ]
  },
  {
    id: 'cadastro',
    titulo: 'Cadastro Inicial',
    icone: '👤',
    passos: [
      'Na página principal, clique em "Login / Entrar no Portal".',
      'Insira o seu número de WhatsApp com DDD.',
      'Se o seu número ainda não estiver registrado, o sistema pedirá algumas informações básicas (Nome, CPF e Email) para criar a sua conta.',
      'Após preencher, clique em "Criar Cadastro" para finalizar.'
    ]
  },
  {
    id: 'matricula',
    titulo: 'Matrícula em Novas Turmas',
    icone: '📝',
    passos: [
      'Faça o login e acesse o "Portal da Família".',
      'No menu principal do portal, clique na opção "Matrículas Online".',
      'Selecione para qual aluno deseja realizar a matrícula (ou adicione um novo aluno).',
      'Escolha a unidade, a modalidade/turma e preencha a ficha de saúde e os dados de pagamento.',
      'Pronto! A matrícula será processada e a vaga estará garantida.'
    ]
  },
  {
    id: 'compra-loja',
    titulo: 'Compra na Loja Virtual',
    icone: '🛍️',
    passos: [
      'Acesse o "Portal da Família" com seu login.',
      'Clique em "Loja de Uniformes" no menu principal.',
      'Navegue pelos produtos, selecione tamanhos (variantes) se necessário, e clique em "Adicionar ao Carrinho".',
      'Quando terminar, clique no ícone de carrinho no canto superior da tela para ir ao Checkout.',
      'Escolha o método de pagamento e clique em "Finalizar Compra". Você poderá retirar os produtos na própria unidade!'
    ]
  },
  {
    id: 'eventos',
    titulo: 'Inscrição em Eventos',
    icone: '🏆',
    passos: [
      'No "Portal da Família", clique em "Eventos & Torneios".',
      'Veja a lista de eventos disponíveis e clique naquele que deseja participar.',
      'Preencha as informações solicitadas (como categoria ou tamanho de camisa, se houver).',
      'Realize o pagamento da taxa de inscrição, caso o evento seja pago.',
      'Você receberá um e-mail de confirmação da sua participação!'
    ]
  },
  {
    id: 'cancelamento',
    titulo: 'Cancelamento de Plano',
    icone: '❌',
    passos: [
      'Para solicitar o cancelamento de uma matrícula ativa, entre em contato diretamente com a secretaria da sua unidade via WhatsApp.',
      'Você também pode visualizar suas assinaturas atuais entrando em contato com nossa equipe de suporte pelo botão flutuante de WhatsApp na tela.'
    ]
  },
  {
    id: 'troca-produto',
    titulo: 'Troca de Produto',
    icone: '🔄',
    passos: [
      'No "Portal da Família", role a tela até a seção "Meus Pedidos".',
      'Clique no pedido que contém o produto que você deseja trocar para expandir os detalhes.',
      'Se o pedido estiver pago, você verá um botão "Solicitar Troca ou Devolução".',
      'Selecione a opção de troca de tamanho ou substituição, descreva o motivo e envie. Nossa equipe analisará e retornará pelo WhatsApp.'
    ]
  },
  {
    id: 'devolucao-produto',
    titulo: 'Devolução de Produtos',
    icone: '↩️',
    passos: [
      'No "Portal da Família", vá até a seção "Meus Pedidos".',
      'Expanda o pedido e clique em "Solicitar Troca ou Devolução".',
      'Escolha a opção "Devolução e Estorno".',
      'Explique o motivo no campo de detalhes e envie. A secretaria avaliará a devolução física do item e prosseguirá com o estorno do valor.'
    ]
  },
  {
    id: 'atualizacao-dados',
    titulo: 'Atualização de Dados Pessoais',
    icone: '✏️',
    passos: [
      'Atualmente, para garantir a segurança dos dados de faturamento, a atualização de informações sensíveis deve ser solicitada à nossa equipe.',
      'Clique no botão flutuante do WhatsApp no canto da tela e informe quais dados você gostaria de alterar (Telefone, E-mail ou Endereço).'
    ]
  },
  {
    id: 'esqueci-senha',
    titulo: 'Esqueci Minha Senha (PIN)',
    icone: '🔐',
    passos: [
      'Na tela de Login, insira o seu número de WhatsApp e prossiga.',
      'Na etapa em que a senha é solicitada, clique no link "Esqueci a Senha" logo abaixo do campo.',
      'Um código de redefinição ou uma nova senha será enviado imediatamente para o seu número de WhatsApp via mensagem oficial.',
      'Use o código recebido para acessar a sua conta novamente.'
    ]
  },
  {
    id: 'alterar-senha',
    titulo: 'Alterar Senha (PIN)',
    icone: '🔑',
    passos: [
      'Ao entrar no "Portal da Família", a redefinição de senha por motivos de segurança pode ser solicitada.',
      'Para alterar o PIN proativamente, acesse a tela inicial, desconecte-se e utilize a função "Esqueci a Senha" ao tentar logar novamente. Você receberá um novo PIN gerado pelo sistema.'
    ]
  },
  {
    id: 'cartao',
    titulo: 'Alterar Cartão (Pagamento Recorrente)',
    icone: '💳',
    passos: [
      'No momento em que a próxima parcela mensal for gerada, caso seu cartão precise ser atualizado, nosso sistema financeiro (Pagar.me / Iugu) enviará um link de fatura.',
      'Nesse link, você poderá inserir um novo cartão de crédito de forma 100% segura. O novo cartão assumirá as recorrências futuras.',
      'Em caso de falha de captura, você também receberá o aviso via WhatsApp com a opção de troca do meio de pagamento.'
    ]
  }
];

export default function CentralAjuda() {
  const [openId, setOpenId] = useState<string | null>(null);
  const { theme } = useFranquiaTheme();

  useEffect(() => {
    document.title = 'Central de Ajuda — Tutoriais';
    window.scrollTo(0, 0);
  }, []);

  const toggleAccordion = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navbar simplificada */}
      <nav className="bg-white border-b border-slate-100 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            {theme?.logo_url ? (
              <img src={theme.logo_url} alt="Logo" className="h-10 object-contain transition-all" />
            ) : (
              <span className="font-black text-slate-800 text-lg tracking-tight">Sport for Kids</span>
            )}
          </Link>
          <Link 
            to="/" 
            className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-50 px-3 py-2 rounded-xl transition-all"
          >
            <ArrowLeft size={16} /> Voltar ao Início
          </Link>
        </div>
      </nav>

      {/* Conteúdo principal */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-12">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookOpen size={32} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Central de Ajuda</h1>
          <p className="text-slate-500 mt-2 text-sm max-w-xl mx-auto">
            Aprenda a utilizar nosso portal. Selecione uma dúvida abaixo para ver o tutorial passo a passo completo.
          </p>
        </div>

        <div className="space-y-3">
          {tutoriais.map((tutorial) => {
            const isOpen = openId === tutorial.id;

            return (
              <div 
                key={tutorial.id} 
                className={`bg-white border rounded-2xl overflow-hidden transition-all duration-300 ${isOpen ? 'border-indigo-300 shadow-lg shadow-indigo-100/50' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <button
                  onClick={() => toggleAccordion(tutorial.id)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{tutorial.icone}</span>
                    <span className={`font-bold ${isOpen ? 'text-indigo-700' : 'text-slate-700'}`}>
                      {tutorial.titulo}
                    </span>
                  </div>
                  <div className={`p-1.5 rounded-full ${isOpen ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'}`}>
                    {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                      <div className="px-6 pb-6 pt-2 border-t border-slate-50">
                        <ol className="space-y-4 relative border-l-2 border-indigo-100 ml-3">
                          {tutorial.passos.map((passo, idx) => (
                            <li key={idx} className="pl-6 relative">
                              <span className="absolute -left-[13px] top-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 border-2 border-white flex items-center justify-center text-xs font-black">
                                {idx + 1}
                              </span>
                              <p className="text-sm text-slate-600 leading-relaxed font-medium pt-0.5">
                                {passo}
                              </p>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
        
        {/* Footer info */}
        <div className="mt-12 text-center p-6 bg-slate-100 rounded-3xl">
          <HelpCircle className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <h3 className="font-bold text-slate-700">Ainda tem dúvidas?</h3>
          <p className="text-xs text-slate-500 mt-1">
            Clique no botão do WhatsApp no canto da tela para falar com nossa equipe de suporte.
          </p>
        </div>
      </div>
    </div>
  );
}
