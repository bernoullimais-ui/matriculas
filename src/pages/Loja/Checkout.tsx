import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, ChevronRight, CreditCard, QrCode, MapPin, Package, Truck, Check, AlertCircle, Loader, Trash2, Tag } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import type { CartItem } from './index';

interface CheckoutPageProps {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function CheckoutPage({ cart, setCart }: CheckoutPageProps) {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Finalizar Pedido — Sport for Kids";
  }, []);
  const [step, setStep] = useState<'dados' | 'pagamento' | 'sucesso'>('dados');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pedidoId, setPedidoId] = useState('');
  const [pixData, setPixData] = useState<{ qr_code: string; qr_code_url: string; expiration: string } | null>(null);

  const [guardian, setGuardian] = useState<any>(null);
  const [couponCode, setCouponCode] = useState('');
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [validCoupon, setValidCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState('');
  const [associations, setAssociations] = useState<Record<string, { alunoId: string; newStudent?: { name: string; birthDate: string; grade: string } }>>({});
  const [seriesOptions, setSeriesOptions] = useState<string[]>([]);
  const [deliverySettings, setDeliverySettings] = useState({ habilitada: false, preco: 0 });
  
  // Installments state
  const [installmentSettings, setInstallmentSettings] = useState({ max_parcelas: 1, min_valor: 50.00 });
  const [selectedInstallment, setSelectedInstallment] = useState(1);

  useEffect(() => {
    async function fetchSeries() {
      try {
        const res = await fetch('/api/options');
        if (res.ok) {
          const data = await res.json();
          setSeriesOptions(data.series || []);
        }
      } catch (err) {
        console.error('Error fetching series options:', err);
      }
    }
    async function fetchSettings() {
      try {
        const res = await fetch(`/api/settings/bulk?keys=loja_entrega_casa_habilitada,loja_entrega_casa_preco,loja_max_parcelas,loja_min_valor_parcela&t=${new Date().getTime()}`);
        if (res.ok) {
          const data = await res.json();
          setDeliverySettings({
            habilitada: data.loja_entrega_casa_habilitada === 'true',
            preco: parseFloat(data.loja_entrega_casa_preco) || 0
          });
          setInstallmentSettings({
            max_parcelas: parseInt(data.loja_max_parcelas) || 1,
            min_valor: parseFloat(data.loja_min_valor_parcela) || 50.00
          });
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      }
    }
    fetchSeries();
    fetchSettings();
  }, []);

  const uniqueStudents = React.useMemo(() => {
    if (!guardian?.alunos) return [];
    const seen = new Set();
    const list: any[] = [];
    guardian.alunos.forEach((aluno: any) => {
      const studentId = aluno.aluno_id || aluno.id;
      if (!seen.has(studentId)) {
        seen.add(studentId);
        list.push({
          id: studentId,
          nome_completo: aluno.nome_completo,
          serie_ano: aluno.serie_ano,
          data_nascimento: aluno.data_nascimento
        });
      }
    });
    return list;
  }, [guardian?.alunos]);

  useEffect(() => {
    const stored = localStorage.getItem('guardian');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setGuardian(parsed);
        // Pre-populate contact fields if available
        setDados(prev => ({
          ...prev,
          nome: prev.nome || parsed.nome_completo || parsed.nome || '',
          email: prev.email || parsed.email || '',
          telefone: prev.telefone || parsed.telefone || '',
          cpf: prev.cpf || parsed.cpf || '',
        }));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  useEffect(() => {
    if (cart.length > 0 && uniqueStudents.length === 1) {
      const studentId = uniqueStudents[0].id;
      setAssociations(prev => {
        const updated = { ...prev };
        let changed = false;
        cart.forEach(item => {
          if (!updated[item.key]) {
            updated[item.key] = { alunoId: studentId };
            changed = true;
          }
        });
        return changed ? updated : prev;
      });
    }
  }, [cart, uniqueStudents]);

  const [dados, setDados] = useState({
    nome: '',
    email: '',
    telefone: '',
    cpf: '',
    tipo_entrega: 'retirada' as 'retirada' | 'entrega',
    metodo_pagamento: 'pix' as 'pix' | 'credit_card',
    observacoes: '',
    // Endereço (para entrega)
    cep: '',
    rua: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    // Cartão
    card_number: '',
    card_name: '',
    card_exp_month: '',
    card_exp_year: '',
    card_cvv: '',
    card_cpf: '',
  });

  const total = cart.reduce((acc, item) => {
    const preco = item.produto.preco_promocional && item.produto.preco_promocional < item.produto.preco
      ? item.produto.preco_promocional : item.produto.preco;
    return acc + preco * item.quantidade;
  }, 0);

  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    setCouponError('');
    try {
      const respId = guardian?.id || 'guest';
      
      // Try validating as a global loja coupon
      let res = await fetch('/api/cupons/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: couponCode,
          responsavel_id: respId,
          contexto: 'loja',
          itemId: null,
          valorOriginal: total
        })
      });
      let data = await res.json();
      
      if (res.ok) {
        setValidCoupon(data);
        toast.success(`Cupom aplicado! Desconto de ${formatCurrency(data.desconto)}`);
        return;
      }
      
      // If it failed due to not matching the product (escopo loja_especifico)
      if (data.error && (data.error.includes('produto selecionado') || data.error.includes('não se aplica'))) {
        let foundMatch = false;
        for (const item of cart) {
          const itemPrice = item.produto.preco_promocional && item.produto.preco_promocional < item.produto.preco
            ? item.produto.preco_promocional : item.produto.preco;
          const itemTotal = itemPrice * item.quantidade;
          
          const tryRes = await fetch('/api/cupons/validar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              codigo: couponCode,
              responsavel_id: respId,
              contexto: 'loja',
              itemId: item.produto.id,
              valorOriginal: itemTotal
            })
          });
          const tryData = await tryRes.json();
          if (tryRes.ok) {
            setValidCoupon({
              ...tryData,
              target_product_id: item.produto.id
            });
            toast.success(`Cupom aplicado! Desconto de ${formatCurrency(tryData.desconto)} no produto ${item.produto.nome}`);
            foundMatch = true;
            break;
          }
        }
        if (!foundMatch) {
          throw new Error('Este cupom não se aplica a nenhum produto do seu carrinho.');
        }
      } else {
        throw new Error(data.error || 'Erro ao validar cupom.');
      }
    } catch (err: any) {
      setCouponError(err.message || 'Erro ao validar cupom.');
      toast.error(err.message || 'Erro ao validar cupom.');
    } finally {
      setValidatingCoupon(false);
    }
  };

  const discountValue = validCoupon ? validCoupon.desconto : 0;
  const shippingCost = dados.tipo_entrega === 'entrega' ? deliverySettings.preco : 0;
  const finalTotal = Math.max(0, total - discountValue) + shippingCost;

  // Calculando as opções de parcelamento
  const availableInstallments = React.useMemo(() => {
    if (finalTotal <= 0) return [1];
    let maxInst = installmentSettings.max_parcelas;
    const minVal = installmentSettings.min_valor;
    
    // Calcula o máximo de parcelas de acordo com o valor mínimo
    while (maxInst > 1 && (finalTotal / maxInst) < minVal) {
      maxInst--;
    }
    
    const options = [];
    for (let i = 1; i <= maxInst; i++) {
      options.push(i);
    }
    return options.length > 0 ? options : [1];
  }, [finalTotal, installmentSettings]);

  // Se a parcela selecionada for maior que o máximo permitido (devido à mudança de valor/frete), ajustar
  useEffect(() => {
    if (selectedInstallment > availableInstallments.length) {
      setSelectedInstallment(availableInstallments.length);
    }
  }, [availableInstallments, selectedInstallment]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setDados(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmitDados = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dados.nome || !dados.email || !dados.telefone || !dados.cpf) {
      setError('Preencha nome, e-mail, telefone e CPF para continuar.');
      return;
    }

    // Validar que cada item no carrinho esteja associado a um dependente
    for (const item of cart) {
      const assoc = associations[item.key];
      if (!assoc || !assoc.alunoId) {
        setError(`Por favor, selecione um dependente para o produto: "${item.produto.nome}".`);
        return;
      }
      if (assoc.alunoId === 'novo') {
        if (!assoc.newStudent?.name.trim() || !assoc.newStudent?.birthDate || !assoc.newStudent?.grade) {
          setError(`Por favor, preencha todos os dados do novo dependente para o produto: "${item.produto.nome}".`);
          return;
        }
      }
    }

    setError('');
    setStep('pagamento');
  };

  const handleFinalizarPedido = async () => {
    setLoading(true);
    setError('');
    try {
      const itens = cart.map(item => {
        const assoc = associations[item.key] || { alunoId: '' };
        return {
          produto_id: item.produto.id,
          nome_produto: item.produto.nome,
          variante_selecionada: item.variante_selecionada,
          quantidade: item.quantidade,
          preco_unitario: item.produto.preco_promocional && item.produto.preco_promocional < item.produto.preco
            ? item.produto.preco_promocional : item.produto.preco,
          aluno_id: assoc.alunoId,
          studentData: assoc.alunoId === 'novo' ? {
            name: assoc.newStudent?.name,
            birthDate: assoc.newStudent?.birthDate,
            grade: assoc.newStudent?.grade
          } : null
        };
      });

      const body = {
        responsavel_id: guardian?.id || null,
        nome_cliente: dados.nome,
        email_cliente: dados.email,
        telefone_cliente: dados.telefone,
        cpf_cliente: dados.cpf,
        tipo_entrega: dados.tipo_entrega,
        metodo_pagamento: dados.metodo_pagamento,
        observacoes: dados.observacoes,
        items: itens,
        total: finalTotal,
        shipping_cost: shippingCost,
        cupom_id: validCoupon ? validCoupon.cupom_id : null,
        endereco_entrega: dados.tipo_entrega === 'entrega' ? {
          cep: dados.cep,
          rua: dados.rua,
          numero: dados.numero,
          complemento: dados.complemento,
          bairro: dados.bairro,
          cidade: dados.cidade,
          estado: dados.estado,
        } : null,
        ...(dados.metodo_pagamento === 'credit_card' ? {
          installments: selectedInstallment,
          card: {
            number: dados.card_number.replace(/\s/g, ''),
            holderName: dados.card_name,
            expMonth: dados.card_exp_month,
            expYear: dados.card_exp_year,
            cvv: dados.card_cvv,
            cpf: dados.card_cpf,
          }
        } : {})
      };

      const res = await fetch('/api/loja/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao processar pedido');

      setPedidoId(data.pedido_id);
      if (dados.metodo_pagamento === 'pix' && (data.pix || data.paymentInfo)) {
        setPixData(data.pix || data.paymentInfo);
      }

      // Sincronizar dependentes atualizados no localStorage
      if (data.alunos && guardian) {
        const updatedGuardian = { ...guardian, alunos: data.alunos };
        setGuardian(updatedGuardian);
        localStorage.setItem('guardian', JSON.stringify(updatedGuardian));
      }

      setCart([]);
      setStep('sucesso');
    } catch (err: any) {
      setError(err.message || 'Erro ao finalizar pedido');
    } finally {
      setLoading(false);
    }
  };

  if (cart.length === 0 && step !== 'sucesso') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <ShoppingCart size={48} className="text-slate-300" />
        <h2 className="text-xl font-bold text-slate-700">Carrinho vazio</h2>
        <Link to="/loja" className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors">
          Ir para a Loja
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-2 text-sm text-slate-500">
          <Link to="/" className="hover:text-indigo-600">Início</Link>
          <ChevronRight size={14} />
          <Link to="/loja" className="hover:text-indigo-600">Loja</Link>
          <ChevronRight size={14} />
          <span className="text-slate-800 font-medium">Checkout</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {step === 'sucesso' ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check size={40} className="text-emerald-600" />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Pedido Realizado!</h1>
            <p className="text-slate-500 text-lg mb-2">
              {dados.metodo_pagamento === 'pix' ? 'Escaneie o QR Code para pagar' : 'Seu pedido foi confirmado'}
            </p>
            <p className="text-slate-400 text-sm mb-8">ID do Pedido: <strong className="text-slate-700">{pedidoId}</strong></p>

            {pixData && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-sm mx-auto mb-8">
                <p className="font-bold text-slate-800 mb-4">Pague via PIX</p>
                {pixData.qr_code_url && (
                  <img src={pixData.qr_code_url} alt="QR Code PIX" className="w-48 h-48 mx-auto mb-4" />
                )}
                {pixData.qr_code && (
                  <>
                    <div className="bg-slate-50 rounded-xl p-3 mb-3">
                      <p className="text-xs text-slate-500 mb-1">Código PIX:</p>
                      <p className="text-xs font-mono break-all text-slate-700">{pixData.qr_code}</p>
                    </div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(pixData.qr_code); }}
                      className="w-full bg-indigo-600 text-white py-2 rounded-xl text-sm font-semibold"
                    >
                      Copiar Código PIX
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="bg-blue-50 rounded-xl p-4 max-w-sm mx-auto mb-8 text-sm text-blue-700">
              <p>Uma mensagem via WhatsApp com os detalhes do pedido foi enviado para seu contato.</p>
            </div>

            <Link
              to="/loja"
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              <Package size={18} />
              Continuar Comprando
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Step indicators */}
              <div className="flex items-center gap-4">
                <div className={`flex items-center gap-2 ${step === 'dados' ? 'text-indigo-600' : 'text-emerald-600'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === 'dados' ? 'bg-indigo-600 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                    {step === 'pagamento' ? <Check size={16} /> : '1'}
                  </div>
                  <span className="font-semibold text-sm">Seus Dados</span>
                </div>
                <div className="flex-1 h-px bg-slate-200" />
                <div className={`flex items-center gap-2 ${step === 'pagamento' ? 'text-indigo-600' : 'text-slate-400'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === 'pagamento' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>2</div>
                  <span className="font-semibold text-sm">Pagamento</span>
                </div>
              </div>

              {step === 'dados' && (
                <motion.form
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onSubmit={handleSubmitDados}
                  className="space-y-5"
                >
                  <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-800 mb-4">Dados de Contato</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nome completo *</label>
                        <input name="nome" value={dados.nome} onChange={handleChange} required
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                          placeholder="Seu nome completo" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">E-mail *</label>
                        <input name="email" type="email" value={dados.email} onChange={handleChange} required
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                          placeholder="seu@email.com" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Telefone / WhatsApp *</label>
                        <input name="telefone" value={dados.telefone} onChange={handleChange} required
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                          placeholder="(11) 99999-9999" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">CPF *</label>
                        <input name="cpf" value={dados.cpf} onChange={handleChange} required
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                          placeholder="000.000.000-00" />
                      </div>
                    </div>
                  </div>

                  {/* Associação de Alunos */}
                  <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
                    <h2 className="text-lg font-bold text-slate-800">Para quem é cada item?</h2>
                    <p className="text-slate-500 text-xs">Associe cada produto ou kit a um dependente cadastrado, ou cadastre um novo dependente.</p>
                    
                    <div className="space-y-4 divide-y divide-slate-100">
                      {cart.map((item, idx) => {
                        const assoc = associations[item.key] || { alunoId: '' };
                        return (
                          <div key={item.key} className={`pt-4 ${idx === 0 ? 'pt-0' : ''} space-y-3`}>
                            <div className="flex gap-3 items-center">
                              <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center">
                                {item.produto.imagens?.[0] ? (
                                  <img src={item.produto.imagens[0]} alt="" className="w-full h-full object-cover" />
                                ) : <Package size={16} className="text-slate-400" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-800 truncate">{item.produto.nome}</p>
                                {Object.entries(item.variante_selecionada).filter(([k]) => k.length !== 36).map(([k, v]) => (
                                  <span key={k} className="text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 mr-1 inline-block capitalize">{k}: {v}</span>
                                ))}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Selecionar Aluno</label>
                                <select
                                  value={assoc.alunoId}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setAssociations(prev => ({
                                      ...prev,
                                      [item.key]: {
                                        alunoId: val,
                                        newStudent: val === 'novo' ? { name: '', birthDate: '', grade: '' } : undefined
                                      }
                                    }));
                                  }}
                                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                >
                                  <option value="">Selecione o Aluno...</option>
                                  {uniqueStudents.map((aluno: any) => (
                                    <option key={aluno.id} value={aluno.id}>{aluno.nome_completo}</option>
                                  ))}
                                  <option value="novo">Cadastrar Novo Aluno</option>
                                </select>
                              </div>

                              {assoc.alunoId === 'novo' && (
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-3">
                                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dados do Novo Dependente</h4>
                                  
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
                                    <input
                                      type="text"
                                      required
                                      placeholder="Nome do seu filho(a)"
                                      value={assoc.newStudent?.name || ''}
                                      onChange={(e) => {
                                        const nameVal = e.target.value;
                                        setAssociations(prev => ({
                                          ...prev,
                                          [item.key]: {
                                            ...prev[item.key],
                                            newStudent: {
                                              ...prev[item.key].newStudent!,
                                              name: nameVal
                                            }
                                          }
                                        }));
                                      }}
                                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nascimento</label>
                                      <input
                                        type="date"
                                        required
                                        value={assoc.newStudent?.birthDate || ''}
                                        onChange={(e) => {
                                          const dateVal = e.target.value;
                                          setAssociations(prev => ({
                                            ...prev,
                                            [item.key]: {
                                              ...prev[item.key],
                                              newStudent: {
                                                ...prev[item.key].newStudent!,
                                                birthDate: dateVal
                                              }
                                            }
                                          }));
                                        }}
                                        className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Série / Ano Letivo</label>
                                      <select
                                        required
                                        value={assoc.newStudent?.grade || ''}
                                        onChange={(e) => {
                                          const gradeVal = e.target.value;
                                          setAssociations(prev => ({
                                            ...prev,
                                            [item.key]: {
                                              ...prev[item.key],
                                              newStudent: {
                                                ...prev[item.key].newStudent!,
                                                grade: gradeVal
                                              }
                                            }
                                          }));
                                        }}
                                        className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                      >
                                        <option value="">Selecione...</option>
                                        {seriesOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                      </select>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tipo entrega */}
                  <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-800 mb-4">Entrega</h2>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <button
                        type="button"
                        onClick={() => setDados(prev => ({ ...prev, tipo_entrega: 'retirada' }))}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${dados.tipo_entrega === 'retirada' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300'}`}
                      >
                        <MapPin size={20} className={dados.tipo_entrega === 'retirada' ? 'text-indigo-600 mb-2' : 'text-slate-400 mb-2'} />
                        <p className={`text-sm font-semibold ${dados.tipo_entrega === 'retirada' ? 'text-indigo-700' : 'text-slate-700'}`}>Retirada na Unidade</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => deliverySettings.habilitada && setDados(prev => ({ ...prev, tipo_entrega: 'entrega' }))}
                        disabled={!deliverySettings.habilitada}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          !deliverySettings.habilitada 
                            ? 'opacity-60 cursor-not-allowed bg-slate-50 border-slate-100' 
                            : dados.tipo_entrega === 'entrega' 
                              ? 'border-indigo-500 bg-indigo-50' 
                              : 'border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        <Truck size={20} className={!deliverySettings.habilitada ? 'text-slate-400 mb-2' : dados.tipo_entrega === 'entrega' ? 'text-indigo-600 mb-2' : 'text-slate-400 mb-2'} />
                        <p className={`text-sm font-semibold ${!deliverySettings.habilitada ? 'text-slate-500' : dados.tipo_entrega === 'entrega' ? 'text-indigo-700' : 'text-slate-700'}`}>
                          Entrega em Casa {deliverySettings.habilitada && deliverySettings.preco > 0 && `(+${formatCurrency(deliverySettings.preco)})`}
                        </p>
                        {!deliverySettings.habilitada && <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Indisponível</p>}
                      </button>
                    </div>

                    {dados.tipo_entrega === 'retirada' && (
                      <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-700">
                        Combinamos o horário de retirada por WhatsApp após a confirmação do pagamento.
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Observações (opcional)</label>
                    <textarea name="observacoes" value={dados.observacoes} onChange={handleChange}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 resize-none"
                      rows={3} placeholder="Ex: tamanho específico, observações para a entrega..." />
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-xl p-3 text-sm">
                      <AlertCircle size={16} /> {error}
                    </div>
                  )}

                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-indigo-200 text-base">
                    Continuar para Pagamento →
                  </button>
                </motion.form>
              )}

              {step === 'pagamento' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-5"
                >
                  <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-800 mb-4">Forma de Pagamento</h2>
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      {[
                        { value: 'pix', label: 'PIX', icon: QrCode, desc: 'Aprovação imediata' },
                        { value: 'credit_card', label: 'Cartão de Crédito', icon: CreditCard, desc: 'Parcelamento disponível' }
                      ].map(({ value, label, icon: Icon, desc }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setDados(prev => ({ ...prev, metodo_pagamento: value as 'pix' | 'credit_card' }))}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${dados.metodo_pagamento === value ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300'}`}
                        >
                          <Icon size={20} className={dados.metodo_pagamento === value ? 'text-indigo-600 mb-2' : 'text-slate-400 mb-2'} />
                          <p className={`text-sm font-bold ${dados.metodo_pagamento === value ? 'text-indigo-700' : 'text-slate-700'}`}>{label}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                        </button>
                      ))}
                    </div>

                    {dados.metodo_pagamento === 'pix' && (
                      <div className="bg-emerald-50 rounded-xl p-4 text-sm text-emerald-700">
                        <p className="font-semibold mb-1">Como funciona:</p>
                        <ol className="list-decimal list-inside space-y-1 text-emerald-600">
                          <li>Clique em "Confirmar Pedido"</li>
                          <li>Um QR Code PIX será gerado</li>
                          <li>Escaneie com o app do seu banco</li>
                          <li>Pedido confirmado automaticamente após pagamento</li>
                        </ol>
                      </div>
                    )}

                    {dados.metodo_pagamento === 'credit_card' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Número do Cartão</label>
                          <input name="card_number" value={dados.card_number} onChange={handleChange}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                            placeholder="0000 0000 0000 0000" maxLength={19} />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nome no Cartão</label>
                          <input name="card_name" value={dados.card_name} onChange={handleChange}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                            placeholder="NOME COMO NO CARTÃO" />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1.5">CPF do Titular do Cartão</label>
                          <input name="card_cpf" value={dados.card_cpf} onChange={handleChange} required
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="000.000.000-00" />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Mês</label>
                            <input name="card_exp_month" value={dados.card_exp_month} onChange={handleChange}
                              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              placeholder="MM" maxLength={2} />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Ano</label>
                            <input name="card_exp_year" value={dados.card_exp_year} onChange={handleChange}
                              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              placeholder="AAAA" maxLength={4} />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">CVV</label>
                            <input name="card_cvv" value={dados.card_cvv} onChange={handleChange}
                              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              placeholder="CVV" maxLength={4} type="password" />
                          </div>
                        </div>

                        {availableInstallments.length > 1 && (
                          <div className="pt-2">
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Parcelamento (Sem Juros)</label>
                            <select 
                              value={selectedInstallment}
                              onChange={(e) => setSelectedInstallment(Number(e.target.value))}
                              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                            >
                              {availableInstallments.map(inst => (
                                <option key={inst} value={inst}>
                                  {inst}x de {formatCurrency(finalTotal / inst)}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-xl p-3 text-sm">
                      <AlertCircle size={16} /> {error}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep('dados')}
                      className="flex-1 bg-white border-2 border-slate-200 text-slate-700 font-bold py-4 rounded-2xl hover:bg-slate-50 transition-all"
                    >
                      ← Voltar
                    </button>
                    <button
                      onClick={handleFinalizarPedido}
                      disabled={loading}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader size={20} className="animate-spin" /> : <Check size={20} />}
                      {loading ? 'Processando...' : 'Confirmar Pedido'}
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sticky top-24">
                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <ShoppingCart size={18} className="text-indigo-600" />
                  Resumo do Pedido
                </h2>

                <div className="space-y-3 mb-4">
                  {cart.map(item => {
                    const preco = item.produto.preco_promocional && item.produto.preco_promocional < item.produto.preco
                      ? item.produto.preco_promocional : item.produto.preco;
                    return (
                      <div key={item.key} className="flex gap-3 items-center group">
                        <div className="w-12 h-12 bg-slate-100 rounded-lg flex-shrink-0 overflow-hidden">
                          {item.produto.imagens?.[0] ? (
                            <img src={item.produto.imagens[0]} alt="" className="w-full h-full object-cover" />
                          ) : <Package size={20} className="text-slate-400 m-auto mt-2" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 line-clamp-2">{item.produto.nome}</p>
                          {Object.entries(item.variante_selecionada).filter(([k]) => k.length !== 36).map(([k, v]) => (
                            <p key={k} className="text-xs text-slate-500">{k}: {v}</p>
                          ))}
                          <p className="text-sm text-slate-600 mt-0.5">×{item.quantidade} — {formatCurrency(preco * item.quantidade)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCart(prev => prev.filter(i => i.key !== item.key))}
                          className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-all flex-shrink-0"
                          title="Remover item"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-slate-100 pt-4">
                  {/* Coupon section */}
                  <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cupom de Desconto</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="EX: SFK10"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        disabled={!!validCoupon}
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs uppercase focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800"
                      />
                      {validCoupon ? (
                        <button
                          type="button"
                          onClick={() => { setValidCoupon(null); setCouponCode(''); }}
                          className="px-3 py-2 bg-red-50 text-red-600 font-bold rounded-xl text-xs hover:bg-red-100 transition-colors"
                        >
                          Remover
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={validatingCoupon || !couponCode.trim()}
                          onClick={handleValidateCoupon}
                          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs disabled:bg-indigo-300 transition-colors"
                        >
                          {validatingCoupon ? 'Validando...' : 'Aplicar'}
                        </button>
                      )}
                    </div>
                    {couponError && (
                      <p className="text-xs text-red-500 mt-1">{couponError}</p>
                    )}
                    {validCoupon && (
                      <p className="text-xs text-emerald-600 font-semibold mt-1">
                        Cupom ativo!
                      </p>
                    )}
                  </div>

                  <div className="border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between text-sm text-slate-600 mb-1">
                      <span>Subtotal</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                    {discountValue > 0 && (
                      <div className="flex items-center justify-between text-sm text-emerald-600 mb-1 font-medium">
                        <span>Desconto</span>
                        <span>-{formatCurrency(discountValue)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm text-slate-600 mb-3">
                      <span>Entrega</span>
                      <span className="text-emerald-600 font-medium">
                        {dados.tipo_entrega === 'retirada' ? 'Grátis (retirada)' : 'A combinar'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span className="text-lg">Total</span>
                      <span className="text-xl text-indigo-600">{formatCurrency(finalTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
