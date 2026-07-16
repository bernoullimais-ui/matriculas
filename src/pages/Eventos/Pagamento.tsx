import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CreditCard, QrCode, CheckCircle, ChevronLeft, Calendar, User, Ticket, Loader2, Copy } from 'lucide-react';
import toast from 'react-hot-toast';

export default function EventoPagamento() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [inscricao, setInscricao] = useState<any>(null);
  
  const [metodoPagamento, setMetodoPagamento] = useState<'credit_card' | 'pix'>('credit_card');
  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExp, setCardExp] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  
  const [cpfPagador, setCpfPagador] = useState('');
  const [telefonePagador, setTelefonePagador] = useState('');

  const [paymentResult, setPaymentResult] = useState<any>(null);

  useEffect(() => {
    fetchInscricao();
  }, [id]);

  const fetchInscricao = async () => {
    try {
      const res = await fetch(`/api/eventos/inscricao/${id}`);
      if (!res.ok) throw new Error('Inscrição não encontrada');
      const data = await res.json();
      setInscricao(data);
      
      // Auto-fill available data
      setCpfPagador(data.respostas_personalizadas?.['CPF do Responsável'] || '');
      setTelefonePagador(data.respostas_personalizadas?.['WhatsApp do Responsável'] || '');
      
      // If already paid via PIX on generation
      if (data.status === 'pendente' && data.respostas_personalizadas?.pix_qr_code) {
        setPaymentResult({
          status: 'pendente',
          qr_code: data.respostas_personalizadas.pix_qr_code,
          qr_code_url: data.respostas_personalizadas.pix_url,
        });
        setMetodoPagamento('pix');
      }

    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar inscrição');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (metodoPagamento === 'credit_card') {
      if (cardNumber.replace(/\D/g, '').length < 15) return toast.error('Número de cartão inválido');
      if (cardExp.length < 5) return toast.error('Validade inválida');
      if (cardCvv.length < 3) return toast.error('CVV inválido');
    }
    
    setProcessing(true);
    try {
      const payload = {
        metodo_pagamento: metodoPagamento,
        cpf_pagador: cpfPagador,
        telefone_pagador: telefonePagador,
        card: metodoPagamento === 'credit_card' ? {
          holder_name: cardHolder,
          number: cardNumber.replace(/\D/g, ''),
          exp_month: Number(cardExp.split('/')[0]),
          exp_year: Number(cardExp.split('/')[1]?.length === 2 ? `20${cardExp.split('/')[1]}` : cardExp.split('/')[1]),
          cvv: cardCvv
        } : undefined
      };

      const res = await fetch(`/api/eventos/inscricao/${id}/pagar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha no pagamento');

      setPaymentResult(data);
      if (data.status === 'confirmado') {
        toast.success('Pagamento aprovado!');
        setInscricao({ ...inscricao, status: 'confirmado', taxa_paga: true });
      }

    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar pagamento');
    } finally {
      setProcessing(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success('Código copiado!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-semibold">Carregando detalhes da inscrição...</p>
      </div>
    );
  }

  if (!inscricao) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 text-center max-w-md w-full">
          <Ticket className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Inscrição não encontrada</h2>
          <p className="text-slate-500 text-sm mb-6">A inscrição que você está tentando acessar não existe ou foi removida.</p>
          <button onClick={() => navigate('/eventos')} className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl w-full hover:bg-indigo-700">
            Ver Eventos
          </button>
        </div>
      </div>
    );
  }

  const evento = inscricao.eventos;
  const isPaid = inscricao.status === 'confirmado' || inscricao.taxa_paga;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          
          <button 
            onClick={() => navigate('/eventos')}
            className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-semibold text-sm mb-6 transition-colors"
          >
            <ChevronLeft size={16} /> Voltar para Eventos
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Detalhes da Inscrição */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                <h3 className="font-black text-slate-900 text-lg mb-4 flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-indigo-600" />
                  Resumo da Inscrição
                </h3>
                
                <div className="space-y-4">
                  <div className="pb-4 border-b border-slate-100">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Evento</p>
                    <p className="font-bold text-slate-800">{evento.titulo}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-2 font-medium">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(evento.data_inicio).toLocaleDateString('pt-BR')}
                    </div>
                  </div>

                  <div className="pb-4 border-b border-slate-100">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Participante</p>
                    <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                      <User className="w-4 h-4 text-slate-400" />
                      {inscricao.nome_aluno}
                    </div>
                    {inscricao.categoria && (
                      <div className="mt-2 inline-flex px-2 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded uppercase tracking-wider">
                        {inscricao.categoria}
                      </div>
                    )}
                  </div>

                  <div className="pt-2">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Total a Pagar</p>
                    <p className="text-3xl font-black text-slate-900">
                      R$ {Number(inscricao.valor_pago).toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pagamento */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm">
                
                {isPaid ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 mb-2">Pagamento Confirmado!</h2>
                    <p className="text-slate-500 mb-8 max-w-md mx-auto">
                      Sua inscrição para o evento {evento.titulo} está confirmada.
                    </p>
                  </div>
                ) : (
                  <>
                    <h2 className="text-xl font-bold text-slate-800 mb-6 border-b border-slate-100 pb-4">
                      Finalizar Pagamento
                    </h2>

                    {paymentResult?.status === 'pendente' && paymentResult.qr_code ? (
                      <div className="flex flex-col items-center justify-center py-8">
                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                          <CheckCircle className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Pedido PIX Gerado!</h3>
                        <p className="text-slate-500 text-sm mb-8 text-center max-w-sm">
                          Escaneie o QR Code abaixo com o aplicativo do seu banco ou copie o código Pix Copia e Cola.
                        </p>
                        
                        {paymentResult.qr_code_url && (
                          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6">
                            <img src={paymentResult.qr_code_url} alt="QR Code PIX" className="w-48 h-48" />
                          </div>
                        )}
                        
                        <div className="w-full max-w-md">
                          <label className="block text-xs font-bold text-slate-500 mb-2">Pix Copia e Cola</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              readOnly
                              value={paymentResult.qr_code}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none"
                            />
                            <button
                              onClick={() => copyToClipboard(paymentResult.qr_code)}
                              className="px-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center shrink-0"
                            >
                              <Copy className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={handlePayment} className="space-y-6">
                        {/* Tipo de Pagamento */}
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Método de Pagamento</label>
                          <div className="grid grid-cols-2 gap-4">
                            <button
                              type="button"
                              onClick={() => setMetodoPagamento('credit_card')}
                              className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${
                                metodoPagamento === 'credit_card' 
                                  ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700' 
                                  : 'border-slate-100 hover:border-slate-200 text-slate-600'
                              }`}
                            >
                              <CreditCard size={24} className="mb-2" />
                              <span className="font-bold text-sm">Cartão de Crédito</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setMetodoPagamento('pix')}
                              className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${
                                metodoPagamento === 'pix' 
                                  ? 'border-emerald-500 bg-emerald-50/50 text-emerald-700' 
                                  : 'border-slate-100 hover:border-slate-200 text-slate-600'
                              }`}
                            >
                              <QrCode size={24} className="mb-2" />
                              <span className="font-bold text-sm">PIX</span>
                            </button>
                          </div>
                        </div>

                        {/* Dados de Pagamento */}
                        <div className="space-y-4 pt-4 border-t border-slate-100">
                          {metodoPagamento === 'credit_card' && (
                            <>
                              <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome no Cartão</label>
                                <input
                                  required
                                  type="text"
                                  value={cardHolder}
                                  onChange={e => setCardHolder(e.target.value.toUpperCase())}
                                  placeholder="Como impresso no cartão"
                                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Número do Cartão</label>
                                  <input
                                    required
                                    type="text"
                                    value={cardNumber}
                                    onChange={e => {
                                      let v = e.target.value.replace(/\D/g, '');
                                      if (v.length > 16) v = v.slice(0, 16);
                                      v = v.replace(/(\d{4})/g, '$1 ').trim();
                                      setCardNumber(v);
                                    }}
                                    placeholder="0000 0000 0000 0000"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Validade</label>
                                    <input
                                      required
                                      type="text"
                                      value={cardExp}
                                      onChange={e => {
                                        let v = e.target.value.replace(/\D/g, '');
                                        if (v.length > 4) v = v.slice(0, 4);
                                        if (v.length > 2) v = v.replace(/(\d{2})(\d+)/, '$1/$2');
                                        setCardExp(v);
                                      }}
                                      placeholder="MM/AA"
                                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CVV</label>
                                    <input
                                      required
                                      type="text"
                                      value={cardCvv}
                                      onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                      placeholder="123"
                                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    />
                                  </div>
                                </div>
                              </div>
                            </>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CPF do Titular / Pagador</label>
                              <input
                                required
                                type="text"
                                value={cpfPagador}
                                onChange={e => {
                                  let v = e.target.value.replace(/\D/g, '');
                                  if (v.length > 11) v = v.slice(0, 11);
                                  if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
                                  else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
                                  else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
                                  setCpfPagador(v);
                                }}
                                placeholder="000.000.000-00"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone (Opcional)</label>
                              <input
                                type="text"
                                value={telefonePagador}
                                onChange={e => {
                                  let v = e.target.value.replace(/\D/g, '');
                                  if (v.length > 11) v = v.slice(0, 11);
                                  if (v.length > 2) v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
                                  if (v.length > 9) v = v.replace(/(\d{5})(\d)/, '$1-$2');
                                  else if (v.length > 8) v = v.replace(/(\d{4})(\d)/, '$1-$2');
                                  setTelefonePagador(v);
                                }}
                                placeholder="(00) 00000-0000"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="pt-6">
                          <button
                            type="submit"
                            disabled={processing}
                            className={`w-full py-4 rounded-2xl font-black uppercase tracking-wider text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${
                              metodoPagamento === 'pix'
                                ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                            } disabled:opacity-50`}
                          >
                            {processing ? (
                              <>
                                <Loader2 size={18} className="animate-spin" />
                                Processando...
                              </>
                            ) : (
                              <>
                                Pagar R$ {Number(inscricao.valor_pago).toFixed(2).replace('.', ',')}
                              </>
                            )}
                          </button>
                          
                          <p className="text-center text-[10px] text-slate-400 mt-4 flex items-center justify-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Pagamento 100% seguro processado pelo Pagar.me
                          </p>
                        </div>
                      </form>
                    )}
                  </>
                )}
              </div>
            </div>
            
          </div>
        </div>
      </main>
    </div>
  );
}
