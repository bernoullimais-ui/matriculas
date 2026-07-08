import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CreditCard, Loader2, CheckCircle, AlertCircle, Calendar, User } from 'lucide-react';

// Use the existing window.PagarMeCheckout if available or a direct API.
// Since the online portal usually loads pagarme.js, we assume window.PagarMe exists.
declare global {
  interface Window {
    PagarMe: any;
  }
}

const PagamentoAtualizar = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [matricula, setMatricula] = useState<any>(null);
  const [valor, setValor] = useState(0);
  const [valorBase, setValorBase] = useState(0);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    cpf: '',
    phone: '',
    cardNumber: '',
    cardHolderName: '',
    cardExpiration: '',
    cardCvv: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchMatricula = async () => {
      try {
        const res = await fetch(`/api/checkout-manual/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao buscar matrícula');
        
        setMatricula(data.matricula);
        setValor(data.valor);
        setValorBase(data.valorBase);
        
        const aluno = Array.isArray(data.matricula.alunos) ? data.matricula.alunos[0] : data.matricula.alunos;
        if (aluno) {
          setFormData(prev => ({
            ...prev,
            name: aluno.responsavel_1 || aluno.nome_completo || '',
            email: aluno.email || '',
            phone: aluno.whatsapp_1 || ''
          }));
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchMatricula();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      // Basic validation
      if (formData.cardNumber.replace(/\D/g, '').length < 13) throw new Error('Número de cartão inválido');
      if (formData.cardCvv.replace(/\D/g, '').length < 3) throw new Error('CVV inválido');
      if (!formData.cardExpiration.includes('/')) throw new Error('Data de validade deve ser no formato MM/AA');

      const [expMonth, expYear] = formData.cardExpiration.split('/');

      // For Pagar.me V5 subscription via backend, we send the card data to the backend.
      // (The backend calls createPagarmeSubscription with card details).
      const payload = {
        matriculaId: id,
        customer: {
          name: formData.name,
          email: formData.email,
          cpf: formData.cpf.replace(/\D/g, ''),
          phone: formData.phone.replace(/\D/g, '')
        },
        card: {
          number: formData.cardNumber.replace(/\D/g, ''),
          holderName: formData.cardHolderName,
          expMonth,
          expYear,
          cvv: formData.cardCvv.replace(/\D/g, ''),
          cpf: formData.cpf.replace(/\D/g, '')
        }
      };

      const res = await fetch('/api/checkout-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao processar pagamento');

      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCardNumber = (value: string) => {
    return value.replace(/\D/g, '').replace(/(\d{4})/g, '$1 ').trim();
  };

  const formatExpiration = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
    }
    return cleaned;
  };

  const formatCPF = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,3})(\d{0,2})$/);
    if (!match) return value;
    let res = match[1];
    if (match[2]) res += `.${match[2]}`;
    if (match[3]) res += `.${match[3]}`;
    if (match[4]) res += `-${match[4]}`;
    return res;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error && !matricula) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Erro ao carregar cobrança</h2>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-10 rounded-[40px] shadow-xl max-w-md w-full text-center border border-slate-100">
          <CheckCircle className="w-20 h-20 text-emerald-500 mx-auto mb-6" />
          <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-3">Pagamento Aprovado!</h2>
          <p className="text-slate-500 mb-8 leading-relaxed">
            Sua assinatura foi configurada com sucesso e a matrícula do aluno está ativa.
          </p>
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8 text-left">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Turma</p>
            <p className="text-lg font-bold text-slate-800 mb-4">{matricula?.turma}</p>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Mensalidade</p>
            <p className="text-lg font-bold text-emerald-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)}/mês
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <div className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 pt-32 pb-20">
        <div className="bg-white rounded-[40px] shadow-xl border border-slate-100 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2">
            
            {/* Esquerda: Resumo */}
            <div className="bg-slate-900 text-white p-10 flex flex-col justify-between">
              <div>
                <h1 className="text-3xl font-black mb-2 tracking-tight">Atualizar Cartão</h1>
                <p className="text-slate-400 mb-10">Configure seu cartão para a cobrança automática da mensalidade.</p>
                
                <div className="space-y-6">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                      <User className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Estudante</p>
                      <p className="text-lg font-bold text-white">
                        {matricula?.alunos ? (Array.isArray(matricula.alunos) ? matricula.alunos[0]?.nome_completo : matricula.alunos?.nome_completo) : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
                      <Calendar className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Turma Selecionada</p>
                      <p className="text-lg font-bold text-white">{matricula?.turma}</p>
                      <p className="text-sm text-slate-400 mt-1">Unidade {matricula?.unidade}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-12 pt-8 border-t border-slate-800">
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Mensalidade Recorrente</p>
                {valorBase > valor && (
                  <p className="text-xl font-bold text-slate-500 line-through mb-1">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorBase)}
                  </p>
                )}
                <p className="text-5xl font-black text-white tracking-tighter">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)}
                </p>
                {valorBase > valor && (
                  <div className="mt-3 inline-block px-3 py-1 bg-emerald-500/20 text-emerald-400 font-bold text-sm rounded-lg">
                    Desconto de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorBase - valor)} aplicado!
                  </div>
                )}
                <p className="text-sm text-slate-400 mt-2">Cobrado automaticamente todo mês no seu cartão.</p>
              </div>
            </div>

            {/* Direita: Formulário */}
            <div className="p-10">
              {error && (
                <div className="mb-8 p-4 bg-red-50 border-2 border-red-100 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-sm font-bold text-red-800">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Seus Dados</h3>
                
                <div className="space-y-4">
                  <input type="text" placeholder="Nome Completo" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm text-slate-800 focus:border-indigo-500 outline-none transition-colors" />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" placeholder="CPF" required maxLength={14} value={formData.cpf} onChange={e => setFormData({...formData, cpf: formatCPF(e.target.value)})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm text-slate-800 focus:border-indigo-500 outline-none transition-colors" />
                    <input type="text" placeholder="Telefone / WhatsApp" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm text-slate-800 focus:border-indigo-500 outline-none transition-colors" />
                  </div>
                  <input type="email" placeholder="E-mail" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm text-slate-800 focus:border-indigo-500 outline-none transition-colors" />
                </div>

                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mt-8">Cartão de Crédito</h3>
                
                <div className="space-y-4">
                  <div className="relative">
                    <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input type="text" placeholder="Número do Cartão" required maxLength={19} value={formData.cardNumber} onChange={e => setFormData({...formData, cardNumber: formatCardNumber(e.target.value)})} className="w-full p-4 pl-12 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm text-slate-800 focus:border-indigo-500 outline-none transition-colors tracking-widest" />
                  </div>
                  
                  <input type="text" placeholder="Nome impresso no cartão" required value={formData.cardHolderName} onChange={e => setFormData({...formData, cardHolderName: e.target.value.toUpperCase()})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm text-slate-800 focus:border-indigo-500 outline-none transition-colors uppercase" />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" placeholder="Validade (MM/AA)" required maxLength={5} value={formData.cardExpiration} onChange={e => setFormData({...formData, cardExpiration: formatExpiration(e.target.value)})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm text-slate-800 focus:border-indigo-500 outline-none transition-colors text-center tracking-widest" />
                    <input type="text" placeholder="CVV" required maxLength={4} value={formData.cardCvv} onChange={e => setFormData({...formData, cardCvv: e.target.value.replace(/\D/g, '')})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm text-slate-800 focus:border-indigo-500 outline-none transition-colors text-center tracking-widest" />
                  </div>
                </div>

                <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 mt-8 hover:-translate-y-1 shadow-lg shadow-indigo-200">
                  {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : 'ASSINAR E CONCLUIR MATRÍCULA'}
                </button>
                <p className="text-xs text-center text-slate-400 mt-4 font-bold flex items-center justify-center gap-2">
                  <CreditCard className="w-4 h-4" /> Pagamento 100% seguro via Pagar.me
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PagamentoAtualizar;
