import React, { useState, useEffect } from 'react';
import { X, Search, User, CreditCard, Link as LinkIcon, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useAdminStore } from '../../stores/adminStore';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function NovaInscricaoEventoModal({ onClose, onSuccess }: Props) {
  const { eventos } = useAdminStore();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [paymentLink, setPaymentLink] = useState('');

  // Formulário
  const [eventoId, setEventoId] = useState('');
  const [categoria, setCategoria] = useState('');
  
  const [isNewUser, setIsNewUser] = useState(false);
  
  // Aluno Selecionado
  const [alunoSearch, setAlunoSearch] = useState('');
  const [alunosOptions, setAlunosOptions] = useState<any[]>([]);
  const [selectedAluno, setSelectedAluno] = useState<any | null>(null);

  // Aluno Novo
  const [nomeAluno, setNomeAluno] = useState('');
  const [nomeResponsavel, setNomeResponsavel] = useState('');
  const [emailResponsavel, setEmailResponsavel] = useState('');
  const [telefoneResponsavel, setTelefoneResponsavel] = useState('');
  const [cpfResponsavel, setCpfResponsavel] = useState('');

  const eventoSelecionado = eventos.find((e: any) => e.id === eventoId);

  // Busca de alunos
  useEffect(() => {
    if (alunoSearch.length < 3 || isNewUser) {
      setAlunosOptions([]);
      return;
    }

    const searchAlunos = async () => {
      const { data, error } = await supabase
        .from('alunos')
        .select(`
          id,
          nome_completo,
          responsavel_id,
          responsaveis (
            id,
            nome_completo,
            email,
            telefone,
            cpf
          )
        `)
        .ilike('nome_completo', `%${alunoSearch}%`)
        .limit(10);

      if (data && !error) {
        setAlunosOptions(data);
      }
    };
    
    const timeout = setTimeout(searchAlunos, 500);
    return () => clearTimeout(timeout);
  }, [alunoSearch, isNewUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventoId) return toast.error('Selecione um evento');
    if (eventoSelecionado?.tipo_preco === 'categorias' && !categoria) {
      return toast.error('Selecione uma categoria');
    }

    if (!isNewUser && !selectedAluno) {
      return toast.error('Selecione um aluno ou escolha preencher os dados manualmente');
    }

    if (isNewUser) {
      if (!nomeAluno || !nomeResponsavel || !emailResponsavel || !telefoneResponsavel) {
        return toast.error('Preencha os dados do novo aluno e responsável');
      }
    }

    setLoading(true);
    try {
      const token = sessionStorage.getItem('admin_token');
      
      const payload = {
        evento_id: eventoId,
        categoria: categoria,
        aluno_id: !isNewUser ? selectedAluno?.id : null,
        responsavel_id: !isNewUser ? selectedAluno?.responsavel_id : null,
        nome_aluno: isNewUser ? nomeAluno : selectedAluno?.nome_completo,
        nome_responsavel: isNewUser ? nomeResponsavel : selectedAluno?.responsaveis?.nome_completo,
        email_responsavel: isNewUser ? emailResponsavel : selectedAluno?.responsaveis?.email,
        telefone_responsavel: isNewUser ? telefoneResponsavel : selectedAluno?.responsaveis?.telefone,
        cpf_responsavel: isNewUser ? cpfResponsavel : selectedAluno?.responsaveis?.cpf
      };

      const res = await fetch('/api/admin/eventos/inscricoes/nova', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao gerar inscrição');
      }

      const data = await res.json();
      setPaymentLink(data.payment_link);
      setStep(2);
      toast.success('Inscrição pendente gerada com sucesso!');

    } catch (err: any) {
      toast.error(err.message || 'Ocorreu um erro');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(paymentLink);
    toast.success('Link copiado!');
  };

  const openWhatsApp = () => {
    const tel = isNewUser ? telefoneResponsavel : selectedAluno?.responsaveis?.telefone;
    const nome = isNewUser ? nomeResponsavel : selectedAluno?.responsaveis?.nome_completo;
    if (!tel) return toast.error('Nenhum telefone encontrado');
    
    const cleanPhone = tel.replace(/\D/g, '');
    const msg = `Olá, ${nome}!\nSua inscrição para o evento *${eventoSelecionado?.titulo}* foi gerada. \n\nAcesse o link abaixo para concluir o pagamento:\n${paymentLink}`;
    window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !loading && onClose()} />
      <div className="relative bg-white rounded-3xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Ticket className="w-5 h-5 text-indigo-600" />
              Nova Inscrição
            </h2>
            <p className="text-sm text-slate-500 mt-1">Gerar cobrança e link de pagamento</p>
          </div>
          <button onClick={onClose} disabled={loading} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {step === 1 ? (
            <form id="nova-inscricao-form" onSubmit={handleSubmit} className="space-y-6">
              
              {/* Evento Selection */}
              <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs">1</span>
                  Selecione o Evento
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Evento</label>
                    <select
                      required
                      value={eventoId}
                      onChange={e => {
                        setEventoId(e.target.value);
                        setCategoria('');
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Selecione...</option>
                      {eventos.map((e: any) => (
                        <option key={e.id} value={e.id}>{e.titulo}</option>
                      ))}
                    </select>
                  </div>

                  {eventoSelecionado?.tipo_preco === 'categorias' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Categoria</label>
                      <select
                        required
                        value={categoria}
                        onChange={e => setCategoria(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">Selecione a categoria...</option>
                        {(eventoSelecionado.opcoes_precos || []).map((op: any, i: number) => (
                          <option key={i} value={op.nome}>{op.nome} - R$ {Number(op.preco).toFixed(2).replace('.', ',')}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Estudante Selection */}
              <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs">2</span>
                    Estudante e Responsável
                  </h3>
                  
                  <div className="flex items-center bg-white rounded-lg border border-slate-200 p-0.5">
                    <button
                      type="button"
                      onClick={() => { setIsNewUser(false); setSelectedAluno(null); setAlunoSearch(''); }}
                      className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-colors ${!isNewUser ? 'bg-indigo-50 text-indigo-700' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      Base de Dados
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsNewUser(true)}
                      className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-colors ${isNewUser ? 'bg-indigo-50 text-indigo-700' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      Pessoa Externa
                    </button>
                  </div>
                </div>

                {!isNewUser ? (
                  <div className="space-y-4">
                    {!selectedAluno ? (
                      <div className="relative">
                        <label className="block text-xs font-bold text-slate-500 mb-1">Buscar Aluno</label>
                        <div className="relative">
                          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Digite o nome do aluno..."
                            value={alunoSearch}
                            onChange={e => setAlunoSearch(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm font-medium focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        {alunosOptions.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                            {alunosOptions.map((a, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setSelectedAluno(a)}
                                className="w-full text-left px-4 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                              >
                                <div className="font-bold text-sm text-slate-800">{a.nome_completo}</div>
                                <div className="text-xs text-slate-500">Resp: {a.responsaveis?.nome_completo || 'N/A'}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-white border border-emerald-200 bg-emerald-50/30 rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-slate-800">{selectedAluno.nome_completo}</p>
                          <p className="text-xs text-slate-500">Responsável: {selectedAluno.responsaveis?.nome_completo}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedAluno(null)}
                          className="text-xs font-bold text-slate-400 hover:text-slate-600 underline"
                        >
                          Trocar
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Nome do Aluno(a)</label>
                      <input
                        required
                        type="text"
                        value={nomeAluno}
                        onChange={e => setNomeAluno(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Nome do Responsável</label>
                      <input
                        required
                        type="text"
                        value={nomeResponsavel}
                        onChange={e => setNomeResponsavel(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Email</label>
                      <input
                        required
                        type="email"
                        value={emailResponsavel}
                        onChange={e => setEmailResponsavel(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">WhatsApp</label>
                      <input
                        required
                        type="text"
                        value={telefoneResponsavel}
                        onChange={e => setTelefoneResponsavel(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>

            </form>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-6">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Inscrição Gerada!</h3>
                <p className="text-slate-500 text-sm max-w-sm mx-auto">
                  A inscrição está com status pendente. Compartilhe o link de pagamento abaixo com o responsável.
                </p>
              </div>

              <div className="w-full max-w-md bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                  <LinkIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-xs font-bold text-slate-500 mb-1">Link de Pagamento</p>
                  <p className="text-sm text-slate-900 truncate">{paymentLink}</p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-4 w-full max-w-md">
                <button
                  onClick={copyToClipboard}
                  className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors text-sm"
                >
                  Copiar Link
                </button>
                <button
                  onClick={openWhatsApp}
                  className="flex-1 px-4 py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-colors text-sm shadow-lg shadow-emerald-500/20"
                >
                  Enviar WhatsApp
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 1 && (
          <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              form="nova-inscricao-form"
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>Processando...</>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Gerar Inscrição
                </>
              )}
            </button>
          </div>
        )}
        
        {step === 2 && (
          <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-center">
            <button
              onClick={onSuccess}
              className="px-8 py-3 text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-sm transition-colors w-full max-w-md"
            >
              Voltar para Inscrições
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
