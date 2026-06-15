import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, ChevronLeft, Trophy, Users, Clock, CreditCard, ArrowRight, ShieldCheck, CheckCircle, Info, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { usePageAnalytics } from '../../hooks/usePageAnalytics';
import LoginModal from '../../components/LoginModal';

interface Evento {
  id: string;
  titulo: string;
  slug: string;
  tipo: string;
  descricao?: string;
  data_inicio: string;
  data_fim?: string;
  prazo_inscricao?: string;
  local?: string;
  unidade_nome?: string;
  imagem_capa?: string;
  imagem_banner?: string;
  vagas_total?: number;
  vagas_disponiveis?: number;
  taxa_inscricao: number;
  gratuito: boolean;
  status: string;
  categorias_inscricao: string[];
  apenas_alunos: boolean;
  tipo_preco?: 'gratuito' | 'fixo' | 'categorias';
  opcoes_precos?: { nome: string; preco: number }[];
  campos_personalizados?: { label: string; tipo: 'text' | 'select'; opcoes?: string[]; obrigatorio: boolean }[];
}

interface Aluno {
  id: string;
  nome?: string;
  nome_completo?: string;
  unidade?: string;
}

const tipoLabel: Record<string, { label: string; cor: string; icon: string }> = {
  competicao: { label: 'Competição', cor: 'bg-red-100 text-red-700', icon: '🏆' },
  apresentacao: { label: 'Apresentação', cor: 'bg-purple-100 text-purple-700', icon: '🎭' },
  aula_publica: { label: 'Aula Pública', cor: 'bg-emerald-100 text-emerald-700', icon: '🎓' },
  workshop: { label: 'Workshop', cor: 'bg-amber-100 text-amber-700', icon: '⚡' },
  evento: { label: 'Evento', cor: 'bg-blue-100 text-blue-700', icon: '📅' },
};

export default function EventoDetalhesPage() {
  const { slug } = useParams<{ slug: string }>();
  usePageAnalytics('/eventos/detalhe', `Evento${slug ? ': ' + slug : ''}`);
  const navigate = useNavigate();

  const [evento, setEvento] = useState<Evento | null>(null);

  useEffect(() => {
    if (evento) {
      document.title = `${evento.titulo} — Sport for Kids`;
    } else {
      document.title = 'Evento — Sport for Kids';
    }
  }, [evento]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [guardian, setGuardian] = useState<any>(null);
  const [alunoSelecionado, setAlunoSelecionado] = useState<string>('');
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>('');
  const [metodoPagamento, setMetodoPagamento] = useState<'pix' | 'credit_card'>('pix');
  const [submitting, setSubmitting] = useState(false);

  // Basic participant details states
  const [nomeEstudante, setNomeEstudante] = useState('');
  const [alunoDataNascimento, setAlunoDataNascimento] = useState('');
  const [nomeResponsavel, setNomeResponsavel] = useState('');
  const [responsavelWhatsapp, setResponsavelWhatsapp] = useState('');
  const [responsavelCpf, setResponsavelCpf] = useState('');
  
  // Custom dynamic form questions answers
  const [respostasPersonalizadas, setRespostasPersonalizadas] = useState<Record<string, string>>({});
  
  // Card states
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardCpf, setCardCpf] = useState('');
  
  // Result screen
  const [paymentResult, setPaymentResult] = useState<any>(null);

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [validCoupon, setValidCoupon] = useState<any>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  // Installments state
  const [installmentSettings, setInstallmentSettings] = useState({ max_parcelas: 1, min_valor: 50.00 });
  const [selectedInstallment, setSelectedInstallment] = useState(1);

  const handleLoginSuccess = (data: any, registeredUnit?: string) => {
    const guardianData = data.guardian || data;
    localStorage.setItem('guardian', JSON.stringify(guardianData));
    
    if (guardianData.students && (!guardianData.alunos || guardianData.alunos.length === 0)) {
      guardianData.alunos = guardianData.students;
    }
    
    setGuardian(guardianData);
    setNomeResponsavel(guardianData.nome_completo || '');
    setResponsavelWhatsapp(guardianData.celular || guardianData.telefone || '');
    setResponsavelCpf(guardianData.cpf || '');
    setIsLoginModalOpen(false);
    
    // Also fetch updated alunos to be safe
    if (guardianData.id) {
      fetch(`/api/guardian/${guardianData.id}/alunos`)
        .then(res => res.json())
        .then(resData => {
          if (resData.alunos) {
            const updated = { ...guardianData, alunos: resData.alunos };
            setGuardian(updated);
            localStorage.setItem('guardian', JSON.stringify(updated));
          }
        })
        .catch(err => console.error('Erro ao atualizar alunos:', err));
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem('guardian');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        
        // Tratar caso de impersonation (admin logando como pai, onde a chave pode ser 'students')
        if (parsed.students && (!parsed.alunos || parsed.alunos.length === 0)) {
          parsed.alunos = parsed.students;
        }
        
        setGuardian(parsed);
        setNomeResponsavel(parsed.nome_completo || '');
        setResponsavelWhatsapp(parsed.celular || parsed.telefone || '');
        setResponsavelCpf(parsed.cpf || '');
        
        // Refresh alunos list to avoid stale localStorage data
        if (parsed.id) {
          fetch(`/api/guardian/${parsed.id}/alunos`)
            .then(res => res.json())
            .then(data => {
              if (data.alunos) {
                const updated = { ...parsed, alunos: data.alunos };
                setGuardian(updated);
                localStorage.setItem('guardian', JSON.stringify(updated));
              }
            })
            .catch(err => console.error('Erro ao atualizar alunos:', err));
        }
      } catch (e) {
        console.error(e);
      }
    }

    async function fetchEvento() {
      setLoading(true);
      try {
        const res = await fetch(`/api/eventos/${slug}`);
        if (!res.ok) throw new Error('Evento não encontrado');
        const data = await res.json();
        setEvento(data);
        
        // Removed auto-select to force user to choose manually
        if (data.tipo_preco === 'categorias' && data.opcoes_precos && data.opcoes_precos.length > 0) {
          setCategoriaSelecionada('');
        } else if (data.categorias_inscricao && data.categorias_inscricao.length > 0) {
          setCategoriaSelecionada('');
        }
      } catch (err: any) {
        toast.error(err.message || 'Erro ao carregar evento');
      } finally {
        setLoading(false);
      }
    }
    async function fetchSettings() {
      try {
        const res = await fetch(`/api/settings/bulk?keys=loja_max_parcelas,loja_min_valor_parcela&t=${new Date().getTime()}`);
        if (res.ok) {
          const data = await res.json();
          setInstallmentSettings({
            max_parcelas: parseInt(data.loja_max_parcelas) || 1,
            min_valor: parseFloat(data.loja_min_valor_parcela) || 50.00
          });
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      }
    }
    
    fetchEvento();
    fetchSettings();
  }, [slug]);

  useEffect(() => {
    if (guardian && alunoSelecionado) {
      const student = guardian.alunos?.find((a: any) => (a.aluno_id || a.id) === alunoSelecionado);
      if (student) {
        setNomeEstudante(student.nome_completo || student.nome || '');
        if (student.data_nascimento) {
          setAlunoDataNascimento(student.data_nascimento.split('T')[0]);
        }
      }
    } else if (alunoSelecionado === '') {
      setNomeEstudante('');
      setAlunoDataNascimento('');
    }
  }, [alunoSelecionado, guardian]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!evento) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Evento não encontrado</h2>
        <Link to="/eventos" className="text-indigo-600 font-semibold hover:underline">Voltar para eventos</Link>
      </div>
    );
  }

  const tipo = tipoLabel[evento.tipo] || tipoLabel.evento;
  const data = new Date(evento.data_inicio);
  const dataFormatada = data.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const horaFormatada = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Categories list
  const categorias: string[] = (evento.categorias_inscricao || []).map((c: any) => 
    typeof c === 'string' ? c : c.nome
  );

  const handleInscricao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guardian) {
      toast.error('Você precisa estar logado no portal para se inscrever.');
      return;
    }

    if (!nomeEstudante) {
      toast.error('O nome do estudante é obrigatório.');
      return;
    }
    if (!alunoDataNascimento) {
      toast.error('A data de nascimento do estudante é obrigatória.');
      return;
    }
    if (!nomeResponsavel) {
      toast.error('O nome do responsável é obrigatório.');
      return;
    }
    if (!responsavelWhatsapp) {
      toast.error('O WhatsApp do responsável é obrigatório.');
      return;
    }
    if (!responsavelCpf) {
      toast.error('O CPF do responsável é obrigatório.');
      return;
    }
    const cleanCpf = responsavelCpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      toast.error('O CPF do responsável deve ser válido (11 dígitos).');
      return;
    }
    
    const aluno = guardian.alunos?.find((a: any) => (a.aluno_id || a.id) === alunoSelecionado);
    if (evento.apenas_alunos && !aluno) {
      toast.error('Selecione um aluno para a inscrição.');
      return;
    }

    // Validar categoria
    if ((categorias.length > 0 || evento.tipo_preco === 'categorias') && !categoriaSelecionada) {
      toast.error('Por favor, selecione uma categoria de inscrição.');
      return;
    }

    // Validar perguntas personalizadas obrigatórias
    const campos = evento.campos_personalizados || [];
    for (const campo of campos) {
      if (campo.obrigatorio && !respostasPersonalizadas[campo.label]) {
        toast.error(`O campo "${campo.label}" é obrigatório.`);
        return;
      }
    }

    let taxa = 0;
    if (evento.tipo_preco === 'fixo') {
      taxa = Number(evento.taxa_inscricao || 0);
    } else if (evento.tipo_preco === 'categorias') {
      const opc = (evento.opcoes_precos || []).find((o: any) => o.nome === categoriaSelecionada);
      taxa = opc ? Number(opc.preco || 0) : 0;
    }
    const finalTotal = Math.max(0, taxa - (validCoupon ? validCoupon.desconto : 0));
    const isFree = (evento.tipo_preco === 'gratuito' || taxa === 0) || (finalTotal <= 0);

    setSubmitting(true);
    try {
      const payload: any = {
        responsavel_id: guardian.id,
        aluno_id: alunoSelecionado || null,
        categoria: categoriaSelecionada,
        nome_aluno: nomeEstudante,
        nome_responsavel: nomeResponsavel,
        email_responsavel: guardian.email,
        telefone_responsavel: responsavelWhatsapp,
        cpf_responsavel: responsavelCpf,
        metodo_pagamento: metodoPagamento,
        unidade: aluno?.unidade || evento.unidade_nome || 'Master',
        aluno_data_nascimento: alunoDataNascimento,
        responsavel_whatsapp: responsavelWhatsapp,
        respostas_personalizadas: respostasPersonalizadas,
        cupom_id: validCoupon ? validCoupon.cupom_id : null,
        valor_desconto: validCoupon ? validCoupon.desconto : 0,
        installments: selectedInstallment
      };

      if (!isFree && metodoPagamento === 'credit_card') {
        const [expMonth, expYear] = cardExpiry.split('/');
        payload.card = {
          number: cardNumber.replace(/\D/g, ''),
          holderName: cardHolder,
          expMonth: expMonth?.trim(),
          expYear: '20' + expYear?.trim(),
          cvv: cardCvv,
          cpf: cardCpf.replace(/\D/g, '')
        };
      }

      const res = await fetch(`/api/eventos/${evento.id}/inscricoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao realizar inscrição');

      setPaymentResult(data);
      toast.success(evento.gratuito ? 'Inscrição realizada!' : 'Pagamento gerado!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar inscrição');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header Banner */}
      <div className="relative h-[300px] md:h-[400px] w-full overflow-hidden">
        <div className="absolute inset-0 bg-slate-900/60 z-10" />
        {evento.imagem_banner ? (
          <img src={evento.imagem_banner} alt={evento.titulo} className="w-full h-full object-cover" />
        ) : evento.imagem_capa ? (
          <img src={evento.imagem_capa} alt={evento.titulo} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-700 via-purple-700 to-pink-700" />
        )}
        
        <div className="absolute inset-0 z-20 flex flex-col justify-between max-w-5xl mx-auto px-4 py-8 text-white">
          <Link to="/eventos" className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors bg-black/20 self-start px-3 py-1.5 rounded-full backdrop-blur-sm text-sm font-semibold">
            <ChevronLeft size={16} /> Voltar para Eventos
          </Link>
          
          <div className="space-y-3">
            <span className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full ${tipo.cor}`}>
              {tipo.icon} {tipo.label}
            </span>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight">{evento.titulo}</h1>
            
            <div className="flex flex-wrap gap-4 text-white/90 text-sm md:text-base pt-2">
              <span className="flex items-center gap-1.5"><Calendar size={18} /> {dataFormatada}</span>
              <span className="flex items-center gap-1.5"><Clock size={18} /> {horaFormatada}h</span>
              {evento.local && <span className="flex items-center gap-1.5"><MapPin size={18} /> {evento.local}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Sobre o Evento</h2>
            {evento.descricao ? (
              <div 
                className="text-slate-600 leading-relaxed space-y-4 max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-indigo-600 [&_a]:underline [&_img]:max-w-full [&_img]:rounded-xl [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-200 [&_td]:p-2 [&_th]:border [&_th]:border-slate-200 [&_th]:p-2 [&_th]:bg-slate-50" 
                dangerouslySetInnerHTML={{ __html: evento.descricao }} 
              />
            ) : (
              <p className="text-slate-600 leading-relaxed">Sem descrição cadastrada.</p>
            )}
          </div>

          {categorias.length > 0 && (
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100">
              <h2 className="text-xl font-bold text-slate-800 mb-4">Categorias & Modalidades</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {categorias.map((cat, idx) => (
                  <div key={idx} className="bg-slate-50 hover:bg-slate-100/80 transition-colors p-4 rounded-2xl flex items-center gap-3 border border-slate-100">
                    <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-700">{cat}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Info & Action */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col">
            <div className="mb-4">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Taxa de Inscrição</p>
              <div className="flex items-baseline gap-2 mt-1">
                {evento.tipo_preco === 'gratuito' || evento.gratuito ? (
                  <span className="text-3xl font-black text-emerald-600">Gratuito</span>
                ) : evento.tipo_preco === 'categorias' && evento.opcoes_precos && evento.opcoes_precos.length > 0 ? (
                  (() => {
                    const precos = evento.opcoes_precos.map(o => Number(o.preco || 0));
                    const min = Math.min(...precos);
                    const max = Math.max(...precos);
                    const format = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
                    return (
                      <span className="text-2xl font-black text-slate-900">
                        {min === max ? format(min) : `${format(min)} a ${format(max)}`}
                      </span>
                    );
                  })()
                ) : (
                  <span className="text-3xl font-black text-slate-900">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(evento.taxa_inscricao)}
                  </span>
                )}
              </div>
            </div>

            {evento.tipo_preco === 'categorias' && evento.opcoes_precos && evento.opcoes_precos.length > 0 && (
              <div className="mb-4 border-t border-slate-100 pt-4">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Selecione a Categoria para Inscrição</label>
                <select
                  value={categoriaSelecionada}
                  onChange={(e) => setCategoriaSelecionada(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-700"
                >
                  <option value="">Selecione uma opção...</option>
                  {evento.opcoes_precos.map((opt, idx) => (
                    <option key={idx} value={opt.nome}>
                      {opt.nome} ({new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(opt.preco)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="border-t border-slate-100 pt-4 mb-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Restrição:</span>
                <span className="font-semibold text-slate-700">
                  {evento.apenas_alunos ? 'Exclusivo para Alunos SFK' : 'Aberto ao público'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Vagas Totais:</span>
                <span className="font-semibold text-slate-700">{evento.vagas_total || 'Ilimitadas'}</span>
              </div>
            </div>

            {guardian ? (
              <button
                onClick={() => {
                  if (evento.tipo_preco === 'categorias' && !categoriaSelecionada) {
                    toast.error('Por favor, selecione uma categoria de inscrição antes de prosseguir.');
                    return;
                  }
                  setShowModal(true);
                }}
                disabled={evento.tipo_preco === 'categorias' && !categoriaSelecionada}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 hover:shadow-xl transition-all"
              >
                Inscrição Online <ArrowRight size={18} />
              </button>
            ) : (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-center">
                <Info className="mx-auto text-amber-600 mb-2" size={24} />
                <p className="text-sm text-amber-800 font-medium mb-3">
                  Faça login no Portal dos Responsáveis para se inscrever neste evento.
                </p>
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-sm transition-all"
                >
                  Ir para Login
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inscription Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]"
            >
              <div className="p-6 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg">Inscrição no Evento</h3>
                  <p className="text-indigo-100 text-xs">{evento.titulo}</p>
                </div>
                <button 
                  onClick={() => { setShowModal(false); setPaymentResult(null); }}
                  className="text-white/80 hover:text-white text-xl font-bold bg-white/10 w-8 h-8 rounded-full flex items-center justify-center"
                >
                  &times;
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {paymentResult ? (
                  /* Success/Payment Screen */
                  <div className="text-center py-4 space-y-5">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl">
                      <CheckCircle size={40} />
                    </div>
                    <div>
                      <h4 className="font-black text-xl text-slate-800">Inscrição Pré-registrada!</h4>
                      <p className="text-slate-500 text-sm mt-1">Inscrição: <span className="font-bold text-slate-800">{paymentResult.inscricao_id?.substring(0, 8).toUpperCase()}</span></p>
                    </div>

                    {evento.gratuito ? (
                      <div className="bg-emerald-50 text-emerald-800 p-4 rounded-2xl text-sm border border-emerald-100">
                        Sua inscrição foi confirmada com sucesso! Não há taxas para este evento.
                      </div>
                    ) : metodoPagamento === 'pix' && paymentResult.paymentInfo?.qr_code ? (
                        <div className="space-y-4">
                          <div className="bg-indigo-50 text-indigo-900 p-4 rounded-2xl text-xs space-y-2 border border-indigo-100 text-left">
                            <p className="font-bold">Como pagar via PIX:</p>
                            <p>1. Copie o código PIX ou escaneie o QR Code</p>
                            <p>2. Abra o app do seu banco e escolha Pix Copia e Cola / QR Code</p>
                            <p>3. Conclua o pagamento</p>
                          </div>

                          {paymentResult.paymentInfo?.qr_code_url && (
                            <div className="flex justify-center bg-white rounded-xl border border-slate-200 p-4">
                              <img src={paymentResult.paymentInfo.qr_code_url} alt="QR Code PIX" className="w-48 h-48" />
                            </div>
                          )}


                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <p className="text-xs font-mono break-all text-slate-700 select-all cursor-text text-left max-h-32 overflow-y-auto">
                            {paymentResult.paymentInfo.qr_code}
                          </p>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(paymentResult.paymentInfo.qr_code);
                                toast.success('Código PIX copiado!');
                              } catch (err) {
                                toast.error('Erro ao copiar. Selecione o texto e copie manualmente.');
                              }
                            }}
                            className="mt-3 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all"
                          >
                            Copiar Código PIX
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-emerald-50 text-emerald-800 p-4 rounded-2xl text-sm border border-emerald-100">
                        Inscrição paga com sucesso via Cartão de Crédito!
                      </div>
                    )}

                    <button
                      onClick={() => { setShowModal(false); setPaymentResult(null); }}
                      className="w-full py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-bold transition-all"
                    >
                      Fechar
                    </button>
                  </div>
                ) : (
                  /* Form Form */
                  <form onSubmit={handleInscricao} className="space-y-4">
                    {/* Informações Básicas Obrigatórias */}
                    <div className="space-y-3.5 border-b border-slate-100 pb-4">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Informações Básicas</h4>
                      
                      {evento.apenas_alunos && (
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Selecione o Aluno Vinculado</label>
                          <select
                            value={alunoSelecionado}
                            onChange={(e) => setAlunoSelecionado(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          >
                            <option value="">Outro / Não cadastrado...</option>
                            {(() => {
                              const seen = new Set();
                              return guardian.alunos?.filter((aluno: any) => {
                                const realId = aluno.aluno_id || aluno.id;
                                if (seen.has(realId)) return false;
                                seen.add(realId);
                                return true;
                              }).map((aluno: any) => (
                                <option key={aluno.aluno_id || aluno.id} value={aluno.aluno_id || aluno.id}>
                                  {aluno.nome_completo || aluno.nome}
                                </option>
                              ));
                            })()}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Estudante *</label>
                        <input
                          type="text"
                          required
                          placeholder="Nome completo do estudante"
                          value={nomeEstudante}
                          onChange={(e) => setNomeEstudante(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data de Nascimento do Estudante *</label>
                        <input
                          type="date"
                          required
                          value={alunoDataNascimento}
                          onChange={(e) => setAlunoDataNascimento(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Responsável *</label>
                        <input
                          type="text"
                          required
                          placeholder="Nome do responsável pelo estudante"
                          value={nomeResponsavel}
                          onChange={(e) => setNomeResponsavel(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">WhatsApp do Responsável *</label>
                        <input
                          type="text"
                          required
                          placeholder="(00) 00000-0000"
                          value={responsavelWhatsapp}
                          onChange={(e) => setResponsavelWhatsapp(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CPF do Responsável *</label>
                        <input
                          type="text"
                          required
                          placeholder="000.000.000-00"
                          value={responsavelCpf}
                          maxLength={14}
                          onChange={(e) => {
                            let v = e.target.value.replace(/\D/g, '');
                            if (v.length <= 11) {
                              v = v.replace(/(\d{3})(\d)/, '$1.$2');
                              v = v.replace(/(\d{3})(\d)/, '$1.$2');
                              v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
                              setResponsavelCpf(v);
                            }
                          }}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Categoria de Inscrição */}
                    {categorias.length > 0 && evento.tipo_preco !== 'categorias' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoria de Inscrição</label>
                        <select
                          required
                          value={categoriaSelecionada}
                          onChange={(e) => setCategoriaSelecionada(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        >
                          <option value="">Selecione uma opção...</option>
                          {categorias.map((cat, idx) => (
                            <option key={idx} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Formulário de Perguntas Personalizadas */}
                    {evento.campos_personalizados && evento.campos_personalizados.length > 0 && (
                      <div className="space-y-3.5 border-t border-slate-100 pt-4">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Perguntas Adicionais</h4>
                        {evento.campos_personalizados.map((campo, idx) => (
                          <div key={idx}>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                              {campo.label} {campo.obrigatorio ? '*' : ''}
                            </label>
                            {campo.tipo === 'select' ? (
                              <select
                                required={campo.obrigatorio}
                                value={respostasPersonalizadas[campo.label] || ''}
                                onChange={(e) => setRespostasPersonalizadas({
                                  ...respostasPersonalizadas,
                                  [campo.label]: e.target.value
                                })}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                              >
                                <option value="">Selecione...</option>
                                {campo.opcoes?.map((opt, oIdx) => (
                                  <option key={oIdx} value={opt}>{opt}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                required={campo.obrigatorio}
                                placeholder="Digite sua resposta..."
                                value={respostasPersonalizadas[campo.label] || ''}
                                onChange={(e) => setRespostasPersonalizadas({
                                  ...respostasPersonalizadas,
                                  [campo.label]: e.target.value
                                })}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Seção de Cupom de Desconto */}
                    {!evento.gratuito && (
                      <div className="space-y-2 border-t border-slate-100 pt-4">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cupom de Desconto</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="EX: SFK10"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value)}
                            disabled={!!validCoupon}
                            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm uppercase focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          />
                          {validCoupon ? (
                            <button
                              type="button"
                              onClick={() => { setValidCoupon(null); setCouponCode(''); }}
                              className="px-4 py-2.5 bg-red-50 text-red-600 font-bold rounded-xl text-xs hover:bg-red-100 transition-colors"
                            >
                              Remover
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={validatingCoupon || !couponCode.trim()}
                              onClick={async () => {
                                setValidatingCoupon(true);
                                try {
                                  let currentTaxa = 0;
                                  if (evento.tipo_preco === 'fixo') {
                                    currentTaxa = Number(evento.taxa_inscricao || 0);
                                  } else if (evento.tipo_preco === 'categorias') {
                                    const opc = (evento.opcoes_precos || []).find((o: any) => o.nome === categoriaSelecionada);
                                    currentTaxa = opc ? Number(opc.preco || 0) : 0;
                                  }
                                  
                                  const res = await fetch('/api/cupons/validar', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      codigo: couponCode,
                                      responsavel_id: guardian.id,
                                      contexto: 'eventos',
                                      itemId: evento.id,
                                      valorOriginal: currentTaxa
                                    })
                                  });
                                  const data = await res.json();
                                  if (!res.ok) throw new Error(data.error || 'Cupom inválido.');
                                  
                                  setValidCoupon(data);
                                  toast.success(`Cupom aplicado! Desconto de R$ ${data.desconto.toFixed(2)}`);
                                } catch (err: any) {
                                  toast.error(err.message || 'Erro ao validar cupom.');
                                } finally {
                                  setValidatingCoupon(false);
                                }
                              }}
                              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs disabled:bg-indigo-300 transition-colors"
                            >
                              {validatingCoupon ? 'Validando...' : 'Aplicar'}
                            </button>
                          )}
                        </div>
                        {validCoupon && (
                          <p className="text-xs text-emerald-600 font-semibold">
                            Cupom ativo! Valor com desconto: R$ {Math.max(0, (evento.tipo_preco === 'fixo' ? Number(evento.taxa_inscricao) : Number((evento.opcoes_precos || []).find(o => o.nome === categoriaSelecionada)?.preco || 0)) - validCoupon.desconto).toFixed(2)}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Non-free fields */}
                    {!evento.gratuito && (!validCoupon || (evento.tipo_preco === 'fixo' ? Number(evento.taxa_inscricao) : Number((evento.opcoes_precos || []).find(o => o.nome === categoriaSelecionada)?.preco || 0)) - validCoupon.desconto > 0) && (
                      <div className="space-y-4 border-t border-slate-100 pt-4">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Método de Pagamento</label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setMetodoPagamento('pix')}
                            className={`py-3 rounded-xl border-2 font-bold flex items-center justify-center gap-1.5 text-sm transition-all ${
                              metodoPagamento === 'pix'
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                : 'border-slate-200 hover:border-slate-300 text-slate-600'
                            }`}
                          >
                            <span>⚡</span> Pix
                          </button>
                          <button
                            type="button"
                            onClick={() => setMetodoPagamento('credit_card')}
                            className={`py-3 rounded-xl border-2 font-bold flex items-center justify-center gap-1.5 text-sm transition-all ${
                              metodoPagamento === 'credit_card'
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                : 'border-slate-200 hover:border-slate-300 text-slate-600'
                            }`}
                          >
                            <CreditCard size={16} /> Cartão
                          </button>
                        </div>

                        {metodoPagamento === 'credit_card' && (
                          <div className="space-y-3 pt-2">
                            <div>
                              <input
                                type="text"
                                placeholder="Número do Cartão"
                                value={cardNumber}
                                onChange={(e) => setCardNumber(e.target.value.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim())}
                                maxLength={19}
                                required
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <input
                                type="text"
                                placeholder="Nome como no Cartão"
                                value={cardHolder}
                                onChange={(e) => setCardHolder(e.target.value)}
                                required
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <input
                                type="text"
                                placeholder="CPF do Titular do Cartão"
                                value={cardCpf}
                                onChange={(e) => setCardCpf(e.target.value)}
                                required
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <input
                                type="text"
                                placeholder="Validade (MM/AA)"
                                value={cardExpiry}
                                onChange={(e) => setCardExpiry(e.target.value)}
                                maxLength={5}
                                required
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                              />
                              <input
                                type="password"
                                placeholder="CVV"
                                value={cardCvv}
                                onChange={(e) => setCardCvv(e.target.value)}
                                maxLength={4}
                                required
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                              />
                            </div>
                            
                            {(() => {
                              let currentTaxa = 0;
                              if (evento.tipo_preco === 'fixo') {
                                currentTaxa = Number(evento.taxa_inscricao || 0);
                              } else if (evento.tipo_preco === 'categorias') {
                                const opc = (evento.opcoes_precos || []).find((o: any) => o.nome === categoriaSelecionada);
                                currentTaxa = opc ? Number(opc.preco || 0) : 0;
                              }
                              const finalTaxa = Math.max(0, currentTaxa - (validCoupon ? validCoupon.desconto : 0));
                              
                              let maxInst = installmentSettings.max_parcelas;
                              const minVal = installmentSettings.min_valor;
                              
                              while (maxInst > 1 && (finalTaxa / maxInst) < minVal) {
                                maxInst--;
                              }
                              
                              const options = [];
                              for (let i = 1; i <= maxInst; i++) {
                                options.push(i);
                              }
                              const availableInstallments = options.length > 0 ? options : [1];
                              
                              if (availableInstallments.length > 1) {
                                return (
                                  <div className="pt-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Parcelamento (Sem Juros)</label>
                                    <select 
                                      value={selectedInstallment > availableInstallments.length ? availableInstallments.length : selectedInstallment}
                                      onChange={(e) => setSelectedInstallment(Number(e.target.value))}
                                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    >
                                      {availableInstallments.map(inst => (
                                        <option key={inst} value={inst}>
                                          {inst}x de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(finalTaxa / inst)}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full mt-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-indigo-400 font-bold rounded-2xl transition-all flex items-center justify-center gap-1.5"
                    >
                      {submitting ? (
                        <>Processando...</>
                      ) : (
                        <>Finalizar Inscrição <ShieldCheck size={16} /></>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)} 
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}
