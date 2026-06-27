import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Calendar, ShoppingBag, CreditCard, ChevronRight, Award, LogOut, Package, Star, CalendarDays, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import TrialModal from '../../components/TrialModal';
import EnrollmentModal from '../../components/EnrollmentModal';
import { useFranquiaTheme } from '../../hooks/useFranquiaTheme';

interface Solicitacao {
  id: string;
  tipo: string;
  detalhes: string;
  status: string;
  created_at: string;
}

interface PedidoItem {
  id: string;
  produto_id?: string;
  nome_produto: string;
  quantidade: number;
  preco_unitario: number;
  variante_selecionada?: any;
}

interface Pedido {
  id: string;
  total: number;
  status: string;
  metodo_pagamento: string;
  status_entrega?: string;
  data_entrega?: string;
  created_at: string;
  loja_pedido_itens?: PedidoItem[];
  loja_pedidos_solicitacoes?: Solicitacao[];
}

interface Inscricao {
  id: string;
  categoria: string;
  status: string;
  created_at: string;
  eventos?: { titulo: string; data_inicio: string };
}

function PedidoCardRow({ pedido }: { pedido: Pedido }) {
  const [expanded, setExpanded] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestType, setRequestType] = useState('troca_tamanho');
  const [requestDetails, setRequestDetails] = useState('');
  
  // New states for the exchange flow
  const [selectedItemId, setSelectedItemId] = useState('');
  const [newProductId, setNewProductId] = useState('');
  const [newVariantSelections, setNewVariantSelections] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>(pedido.loja_pedidos_solicitacoes || []);

  // Fetch products when opening form
  useEffect(() => {
    if (showRequestForm && products.length === 0) {
      setLoadingProducts(true);
      fetch('/api/loja/produtos')
        .then(r => r.json())
        .then(data => setProducts(data.produtos || []))
        .catch(err => console.error("Erro ao buscar produtos:", err))
        .finally(() => setLoadingProducts(false));
    }
  }, [showRequestForm]);

  const handleSubitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId) {
      toast.error('Selecione qual item do pedido você deseja trocar/devolver.');
      return;
    }
    
    // Find selected old item
    const oldItem = pedido.loja_pedido_itens?.find(i => i.id === selectedItemId);
    let diff = 0;
    
    if (requestType === 'substituicao') {
      if (!newProductId) return { toast: toast.error('Selecione o novo produto.') };
      const newProd = products.find(p => p.id === newProductId);
      if (newProd && oldItem) {
        const newPrice = newProd.preco_promocional || newProd.preco;
        diff = Number(newPrice) - Number(oldItem.preco_unitario);
      }
    } else if (requestType === 'devolucao') {
      if (oldItem) diff = -Number(oldItem.preco_unitario);
    }
    
    if (!requestDetails.trim() && requestType === 'devolucao') {
      toast.error('Informe os detalhes da solicitação de devolução.');
      return;
    }
    
    setSubmitting(true);
    try {
      const res = await fetch('/api/portal/loja/pedidos/solicitacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedido_id: pedido.id,
          tipo: requestType,
          detalhes: requestDetails || 'Troca solicitada via portal.',
          item_id: selectedItemId,
          novo_produto_id: requestType === 'substituicao' ? newProductId : (requestType === 'troca_tamanho' ? oldItem?.produto_id : null),
          nova_variante: Object.keys(newVariantSelections).length > 0 ? newVariantSelections : null,
          diferenca_valor: diff
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar solicitação');
      
      setSolicitacoes([data, ...solicitacoes]);
      toast.success('Solicitação registrada com sucesso!');
      setRequestDetails('');
      setShowRequestForm(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar solicitação');
    } finally {
      setSubmitting(false);
    }
  };

  const statusLabels: Record<string, string> = {
    troca_tamanho: 'Troca de Tamanho',
    substituicao: 'Substituição por Outro Produto',
    devolucao: 'Devolução e Estorno'
  };

  let isFormValid = !!selectedItemId;
  if (isFormValid && requestType === 'substituicao' && !newProductId) isFormValid = false;
  if (isFormValid && (requestType === 'substituicao' || requestType === 'troca_tamanho')) {
    let targetProduct = null;
    if (requestType === 'substituicao') {
      targetProduct = products.find(p => p.id === newProductId);
    } else {
      const oldItem = pedido.loja_pedido_itens?.find(i => i.id === selectedItemId);
      if (oldItem?.produto_id) {
        targetProduct = products.find(p => p.id === oldItem.produto_id);
      }
    }
    if (targetProduct && targetProduct.variantes) {
      for (const v of targetProduct.variantes) {
        if (!newVariantSelections[v.tipo]) {
          isFormValid = false;
          break;
        }
      }
    }
  }

  let expiredExchange = false;
  if (pedido.status_entrega === 'entregue' && pedido.data_entrega) {
    const diffTime = Math.abs(new Date().getTime() - new Date(pedido.data_entrega).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 7) {
      expiredExchange = true;
    }
  }

  const statusEntregaLabels: Record<string, string> = {
    pendente: 'Aguardando Separação',
    preparando: 'Preparando Pedido',
    disponivel_unidade: 'Disponível na Unidade',
    rota_entrega: 'Em Rota de Entrega',
    entregue: 'Entregue'
  };

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-100 p-3.5 space-y-3 hover:bg-slate-100/30 transition-all text-xs">
      <div className="flex justify-between items-center cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div>
          <p className="font-bold text-slate-700 flex items-center gap-1">
            Pedido #{pedido.id.substring(0, 8).toUpperCase()}
            <span className="text-[10px] text-slate-400 font-normal">({expanded ? 'Ocultar' : 'Ver detalhes'})</span>
          </p>
          <p className="text-slate-400 text-[10px] mt-0.5">{new Date(pedido.created_at).toLocaleDateString()}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-slate-900">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pedido.total)}
          </p>
          <div className="flex flex-col items-end gap-1 mt-1.5">
            <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${
              pedido.status === 'pago' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {pedido.status}
            </span>
            {pedido.status_entrega && pedido.status_entrega !== 'pendente' && (
              <span className="inline-block px-2 py-0.5 rounded-full font-bold text-[9px] uppercase bg-blue-100 text-blue-700 mt-1">
                {statusEntregaLabels[pedido.status_entrega] || pedido.status_entrega}
              </span>
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-200/60 pt-3.5 space-y-3.5 animate-fadeIn">
          <div>
            <h4 className="font-bold text-slate-700 mb-1">Itens do Pedido:</h4>
            <div className="space-y-1 bg-white p-2.5 rounded-xl border border-slate-100">
              {pedido.loja_pedido_itens?.map((item, idx) => (
                <div key={idx} className="flex flex-col text-[11px] pb-1.5 border-b border-slate-50 last:border-0 last:pb-0">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-semibold">{item.quantidade}x {item.nome_produto}</span>
                    <span className="text-slate-900 font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.preco_unitario * item.quantidade)}</span>
                  </div>
                  {item.variante_selecionada && (
                    <div className="text-[9px] text-slate-400 mt-0.5 ml-3 border-l-2 border-slate-200 pl-1.5">
                      {Object.entries(item.variante_selecionada).map(([k, v]) => `${k}: ${v}`).join(' - ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {solicitacoes.length > 0 && (
            <div>
              <h4 className="font-bold text-slate-700 mb-1">Solicitações de Troca/Devolução:</h4>
              <div className="space-y-2">
                {solicitacoes.map((sol) => (
                  <div key={sol.id} className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-100/50 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-amber-900 text-[10px]">{statusLabels[sol.tipo] || sol.tipo}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                        sol.status === 'concluido' ? 'bg-emerald-100 text-emerald-700' :
                        sol.status === 'rejeitado' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                      }`}>{sol.status}</span>
                    </div>
                    <p className="text-slate-600 text-[10px]">{sol.detalhes}</p>
                    <p className="text-slate-400 text-[9px]">{new Date(sol.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pedido.status === 'pago' && (
            <div>
              {expiredExchange ? (
                <div className="p-2 bg-red-50 border border-red-100 rounded-lg">
                  <p className="text-[10px] text-red-600 font-semibold text-center">
                    Prazo de 7 dias para troca ou devolução expirado.
                  </p>
                </div>
              ) : !showRequestForm ? (
                <button
                  onClick={() => setShowRequestForm(true)}
                  className="px-3 py-1.5 font-bold text-xs bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                >
                  Solicitar Troca ou Devolução
                </button>
              ) : (
                <form onSubmit={handleSubitRequest} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3 relative">
                  {loadingProducts && (
                    <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
                      <span className="text-xs font-bold text-slate-500 animate-pulse">Carregando catálogo...</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-700">Nova Solicitação</span>
                    <button type="button" onClick={() => setShowRequestForm(false)} className="text-slate-400 hover:text-slate-600 font-bold">&times; Cancelar</button>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Qual item deseja trocar/devolver?</label>
                      <select required value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs">
                        <option value="">Selecione um item...</option>
                        {pedido.loja_pedido_itens?.map(item => {
                          const varStr = item.variante_selecionada ? ` (${Object.values(item.variante_selecionada).join(', ')})` : '';
                          return (
                            <option key={item.id} value={item.id}>
                              {item.nome_produto}{varStr} - Pago: R$ {item.preco_unitario}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">O que deseja fazer?</label>
                      <select required value={requestType} onChange={(e) => { setRequestType(e.target.value); setNewProductId(''); setNewVariantSelections({}); }} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs">
                        <option value="troca_tamanho">Trocar Tamanho/Cor (Mesmo Produto)</option>
                        <option value="substituicao">Trocar por Outro Produto</option>
                        <option value="devolucao">Devolver Produto (Reembolso)</option>
                      </select>
                    </div>

                    {requestType === 'substituicao' && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Novo Produto Desejado</label>
                        <select required value={newProductId} onChange={(e) => { setNewProductId(e.target.value); setNewVariantSelections({}); }} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs">
                          <option value="">Selecione o produto...</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.nome} - R$ {p.preco_promocional || p.preco}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {(requestType === 'troca_tamanho' || (requestType === 'substituicao' && newProductId)) && (
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Selecione a Nova Variante (Tamanho/Cor)</label>
                        {(() => {
                          let targetProduct = null;
                          if (requestType === 'substituicao') {
                            targetProduct = products.find(p => p.id === newProductId);
                          } else {
                            const oldItem = pedido.loja_pedido_itens?.find(i => i.id === selectedItemId);
                            if (oldItem?.produto_id) {
                              targetProduct = products.find(p => p.id === oldItem.produto_id);
                            }
                          }
                          if (!targetProduct || !targetProduct.variantes || targetProduct.variantes.length === 0) {
                            return <p className="text-[10px] text-slate-400">Produto sem opções de variantes.</p>;
                          }
                          
                          return targetProduct.variantes.map((v: any) => (
                            <div key={v.tipo}>
                              <span className="text-[10px] font-semibold text-slate-500 capitalize">{v.tipo}:</span>
                              <select 
                                required
                                value={newVariantSelections[v.tipo] || ''}
                                onChange={(e) => setNewVariantSelections({...newVariantSelections, [v.tipo]: e.target.value})}
                                className="w-full mt-1 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                              >
                                <option value="">Selecione...</option>
                                {v.opcoes.map((opt: string) => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            </div>
                          ));
                        })()}
                      </div>
                    )}

                    {/* Exibir o cálculo da diferença */}
                    {selectedItemId && requestType !== 'troca_tamanho' && (
                      <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-lg">
                        {(() => {
                          const oldItem = pedido.loja_pedido_itens?.find(i => i.id === selectedItemId);
                          if (!oldItem) return null;
                          let diff = 0;
                          if (requestType === 'substituicao' && newProductId) {
                            const newProd = products.find(p => p.id === newProductId);
                            if (newProd) diff = Number(newProd.preco_promocional || newProd.preco) - Number(oldItem.preco_unitario);
                          } else if (requestType === 'devolucao') {
                            diff = -Number(oldItem.preco_unitario);
                          }

                          if (diff > 0) {
                            return <p className="text-indigo-800 text-xs font-bold">Você pagará a diferença de R$ {diff.toFixed(2)}</p>;
                          } else if (diff < 0) {
                            return <p className="text-emerald-700 text-xs font-bold">Você receberá um crédito (Cupom) de R$ {Math.abs(diff).toFixed(2)}</p>;
                          } else if (requestType === 'substituicao' && newProductId) {
                            return <p className="text-slate-600 text-xs font-bold">Troca equivalente. Sem custos adicionais.</p>;
                          }
                          return null;
                        })()}
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Detalhes Adicionais (Opcional)</label>
                      <textarea
                        placeholder="Ex: Estou devolvendo porque ficou pequeno."
                        value={requestDetails}
                        onChange={(e) => setRequestDetails(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs h-12 resize-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !isFormValid}
                    className={`w-full py-2 font-bold rounded-lg text-xs transition-colors mt-2 ${
                      submitting || !isFormValid 
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {submitting ? 'Enviando...' : 'Enviar Solicitação'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PortalLandingPage() {
  const navigate = useNavigate();
  const { theme } = useFranquiaTheme();

  useEffect(() => {
    document.title = "Portal da Família — Sport for Kids";
  }, []);
  const [guardian, setGuardian] = useState<any>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([]);
  const [loading, setLoading] = useState(true);

  // Trial scheduling modal states
  const [unidades, setUnidades] = useState<any[]>([]);
  const [series, setSeries] = useState<string[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [isTrialModalOpen, setIsTrialModalOpen] = useState(false);
  const [isEnrollmentModalOpen, setIsEnrollmentModalOpen] = useState(false);
  const [modalInitialStep, setModalInitialStep] = useState<any>(undefined);
  const [modalInitialTab, setModalInitialTab] = useState<any>(undefined);
  const [bookingData, setBookingData] = useState({ unidade: '', turma: '' });

  useEffect(() => {
    const stored = localStorage.getItem('guardian');
    if (!stored) {
      toast.error('Por favor, faça login para acessar o portal.');
      const search = window.location.search;
      navigate(`/${search}`);
      return;
    }

    const parsedGuardian = JSON.parse(stored);
    setGuardian(parsedGuardian);

    async function fetchPortalData() {
      try {
        const [pedidosRes, inscricoesRes] = await Promise.all([
          fetch(`/api/portal/loja/pedidos?responsavel_id=${parsedGuardian.id}`).then(r => r.json()),
          fetch(`/api/portal/eventos/inscricoes?responsavel_id=${parsedGuardian.id}`).then(r => r.json())
        ]);
        setPedidos(pedidosRes || []);
        setInscricoes(inscricoesRes || []);
      } catch (err) {
        console.error('Erro ao carregar dados do portal:', err);
      } finally {
        setLoading(false);
      }
    }

    async function fetchOptions() {
      try {
        const res = await fetch('/api/options');
        if (res.ok) {
          const data = await res.json();
          setUnidades(data.unidades || []);
          setSeries(data.series || []);
          setTurmas(data.turmas || []);
        }
      } catch (err) {
        console.error('Error fetching options in portal:', err);
      }
    }

    fetchPortalData();
    fetchOptions();

    // Check if redirecting from landing page to book a class
    const bookingRedirect = localStorage.getItem('booking_redirect');
    if (bookingRedirect) {
      try {
        const parsedRedirect = JSON.parse(bookingRedirect);
        setBookingData(prev => ({
          ...prev,
          unidade: parsedRedirect.unidade || '',
          turma: parsedRedirect.turma || ''
        }));
        setIsTrialModalOpen(true);
        localStorage.removeItem('booking_redirect');
      } catch (e) {
        console.error('Error parsing booking redirect:', e);
      }
    }
  }, [navigate]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action') || urlParams.get('acao');
    if (action === 'trial' || action === 'experimental') {
      const stored = localStorage.getItem('guardian');
      if (stored) {
        setIsTrialModalOpen(true);
        // Clean query params
        const url = new URL(window.location.href);
        url.searchParams.delete('action');
        url.searchParams.delete('acao');
        window.history.replaceState({}, '', url.pathname + url.search);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('guardian');
    toast.success('Sessão encerrada.');
    navigate('/');
  };



  if (!guardian) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-slate-100 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <Link to="/portal" className="flex items-center gap-2">
              {theme?.logo_url ? (
                <img src={theme.logo_url} alt="Sport for Kids" className="h-10 object-contain transition-all" />
              ) : (
                <span className="font-black text-slate-800 text-lg tracking-tight">Sport for Kids</span>
              )}
            </Link>
            {localStorage.getItem('last_unit_slug') && (
              <button
                onClick={() => navigate(`/portal/${localStorage.getItem('last_unit_slug')}`)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-xl transition-all shadow-sm"
              >
                Início
              </button>
            )}
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/tutoriais"
              className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors"
            >
              <HelpCircle size={16} /> Central de Ajuda
            </Link>
            <div className="flex items-center gap-2 text-slate-700 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
              <User size={16} className="text-indigo-600" />
              <span className="text-xs font-bold truncate max-w-[150px]">{guardian.nome_completo}</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
              title="Sair"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-10">
        
        {/* Welcome Section */}
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900">Olá, {guardian.nome_completo.split(' ')[0]} 👋</h1>
          <p className="text-slate-500 text-sm md:text-base mt-1">Bem-vindo ao seu portal. Gerencie matrículas, compre uniformes e inscreva-se em eventos.</p>
        </div>

        {/* 4 Main Services Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Aula Experimental Card */}
          <motion.div
            whileHover={{ y: -5 }}
            onClick={() => setIsTrialModalOpen(true)}
            className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl p-6 text-white shadow-xl shadow-emerald-100 flex flex-col justify-between h-[200px] relative overflow-hidden group cursor-pointer"
          >
            <div className="absolute right-[-20px] bottom-[-20px] text-9xl opacity-10 group-hover:scale-110 transition-transform duration-300">✨</div>
            <div>
              <span className="p-2.5 bg-white/10 rounded-2xl inline-block text-xl">✨</span>
              <h3 className="font-black text-xl mt-3">Aula Experimental</h3>
              <p className="text-emerald-100 text-xs mt-1.5">Agende uma aula gratuita para conhecer nossa metodologia.</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setIsTrialModalOpen(true); }}
              className="mt-4 bg-white text-emerald-700 hover:bg-emerald-50 font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 self-start transition-all shadow-sm"
            >
              Agendar Aula <ChevronRight size={14} />
            </button>
          </motion.div>

          {/* Matrículas Card */}
          <motion.div
            whileHover={{ y: -5 }}
            className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-100 flex flex-col justify-between h-[200px] relative overflow-hidden group"
          >
            <div className="absolute right-[-20px] bottom-[-20px] text-9xl opacity-10 group-hover:scale-110 transition-transform duration-300">📝</div>
            <div>
              <span className="p-2.5 bg-white/10 rounded-2xl inline-block text-xl">📝</span>
              <h3 className="font-black text-xl mt-3">Matrículas Online</h3>
              <p className="text-indigo-100 text-xs mt-1.5">Matricule seus filhos em novas turmas ou modalidades.</p>
            </div>
            <button
              onClick={() => setIsEnrollmentModalOpen(true)}
              className="mt-4 bg-white text-indigo-700 hover:bg-indigo-50 font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 self-start transition-all shadow-sm"
            >
              Acessar Matrículas <ChevronRight size={14} />
            </button>
          </motion.div>

          {/* Loja Virtual Card */}
          <motion.div
            whileHover={{ y: -5 }}
            className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-3xl p-6 text-white shadow-xl shadow-purple-100 flex flex-col justify-between h-[200px] relative overflow-hidden group"
          >
            <div className="absolute right-[-20px] bottom-[-20px] text-9xl opacity-10 group-hover:scale-110 transition-transform duration-300">🛍️</div>
            <div>
              <span className="p-2.5 bg-white/10 rounded-2xl inline-block text-xl">🛍️</span>
              <h3 className="font-black text-xl mt-3">Loja de Uniformes</h3>
              <p className="text-purple-100 text-xs mt-1.5">Compre camisetas, shorts e kits oficiais para as aulas.</p>
            </div>
            <Link
              to="/loja"
              className="mt-4 bg-white text-purple-700 hover:bg-purple-50 font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 self-start transition-all shadow-sm"
            >
              Acessar Loja <ChevronRight size={14} />
            </Link>
          </motion.div>

          {/* Central de Eventos Card */}
          <motion.div
            whileHover={{ y: -5 }}
            className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-3xl p-6 text-white shadow-xl shadow-pink-100 flex flex-col justify-between h-[200px] relative overflow-hidden group"
          >
            <div className="absolute right-[-20px] bottom-[-20px] text-9xl opacity-10 group-hover:scale-110 transition-transform duration-300">🏆</div>
            <div>
              <span className="p-2.5 bg-white/10 rounded-2xl inline-block text-xl">🏆</span>
              <h3 className="font-black text-xl mt-3">Eventos & Torneios</h3>
              <p className="text-pink-100 text-xs mt-1.5">Inscrições para competições, festivals e aulas públicas.</p>
            </div>
            <Link
              to="/eventos"
              className="mt-4 bg-white text-pink-700 hover:bg-pink-50 font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 self-start transition-all shadow-sm"
            >
              Ver Eventos <ChevronRight size={14} />
            </Link>
          </motion.div>
        </div>

        {/* Acessos Rápidos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button 
            onClick={() => { setModalInitialStep('portal'); setModalInitialTab('profile'); setIsEnrollmentModalOpen(true); }}
            className="bg-white border border-slate-100 p-4 rounded-2xl flex items-center gap-4 hover:shadow-md hover:border-indigo-100 transition-all text-left"
          >
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0">
              <User size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-800 text-sm">Meus Dados (Responsável)</h3>
              <p className="text-slate-400 text-xs mt-0.5">Atualize suas informações de contato e endereço.</p>
            </div>
            <ChevronRight size={20} className="text-slate-300 shrink-0" />
          </button>

          <button 
            onClick={() => { setModalInitialStep('portal'); setModalInitialTab('dashboard'); setIsEnrollmentModalOpen(true); }}
            className="bg-white border border-slate-100 p-4 rounded-2xl flex items-center gap-4 hover:shadow-md hover:border-emerald-100 transition-all text-left"
          >
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
              <CreditCard size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-800 text-sm">Minhas Matrículas</h3>
              <p className="text-slate-400 text-xs mt-0.5">Gerencie alunos, planos e pagamentos.</p>
            </div>
            <ChevronRight size={20} className="text-slate-300 shrink-0" />
          </button>
        </div>

        {/* Dashboard / History List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Recent Orders */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-50">
              <h3 className="font-black text-slate-800 flex items-center gap-2 text-base">
                <ShoppingBag size={18} className="text-purple-600" /> Meus Pedidos
              </h3>
              <Link to="/loja" className="text-xs font-bold text-indigo-600 hover:underline">Comprar mais</Link>
            </div>

            {loading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-10 bg-slate-100 rounded-xl"></div>
                <div className="h-10 bg-slate-100 rounded-xl"></div>
              </div>
            ) : pedidos.length === 0 ? (
              <p className="text-slate-400 text-xs py-6 text-center">Nenhum pedido realizado ainda.</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {pedidos.map(p => (
                  <PedidoCardRow key={p.id} pedido={p} />
                ))}
              </div>
            )}
          </div>

          {/* Event Inscriptions */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-50">
              <h3 className="font-black text-slate-800 flex items-center gap-2 text-base">
                <Calendar size={18} className="text-pink-600" /> Inscrições em Eventos
              </h3>
              <Link to="/eventos" className="text-xs font-bold text-indigo-600 hover:underline">Ver eventos</Link>
            </div>

            {loading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-10 bg-slate-100 rounded-xl"></div>
                <div className="h-10 bg-slate-100 rounded-xl"></div>
              </div>
            ) : inscricoes.length === 0 ? (
              <p className="text-slate-400 text-xs py-6 text-center">Nenhuma inscrição realizada ainda.</p>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {inscricoes.map(ins => (
                  <div key={ins.id} className="p-3 bg-slate-50 rounded-2xl flex justify-between items-center text-xs border border-slate-100 hover:bg-slate-100/50 transition-all">
                    <div>
                      <p className="font-bold text-slate-700">{ins.eventos?.titulo}</p>
                      <p className="text-slate-400 text-[10px] mt-0.5">Cat: <span className="font-semibold text-slate-600">{ins.categoria}</span></p>
                      <p className="text-slate-400 text-[10px] mt-0.5">
                        Data: {ins.eventos?.data_inicio ? new Date(ins.eventos.data_inicio).toLocaleDateString() : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${
                        ins.status === 'confirmado' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {ins.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Trial Modal */}
      <TrialModal 
        isOpen={isTrialModalOpen}
        onClose={() => setIsTrialModalOpen(false)}
        guardian={guardian}
        setGuardian={setGuardian}
        unidades={unidades}
        turmas={turmas}
        series={series}
        initialUnidade={bookingData.unidade}
        initialTurma={bookingData.turma}
      />

      <EnrollmentModal 
        isOpen={isEnrollmentModalOpen} 
        onClose={() => setIsEnrollmentModalOpen(false)} 
        initialStep={modalInitialStep}
        initialPortalTab={modalInitialTab}
      />
    </div>
  );
}
