import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, ChevronRight, ChevronLeft, Package, Star, Check, ArrowRight, Minus, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import type { CartItem } from './index';
import { usePageAnalytics } from '../../hooks/usePageAnalytics';

interface KitItem {
  id: string;
  kit_produto_id: string;
  componente_produto_id: string;
  componente_variante_key: string;
  quantidade: number;
  componente?: {
    id: string;
    nome: string;
    slug: string;
    preco: number;
    preco_promocional?: number;
    imagens: string[];
    variantes: { tipo: string; opcoes: string[] }[];
    estoque_por_variante: Record<string, number>;
  };
}

interface Produto {
  id: string;
  nome: string;
  slug: string;
  descricao?: string;
  preco: number;
  preco_promocional?: number;
  imagens: string[];
  variantes: { tipo: string; opcoes: string[] }[];
  estoque_por_variante: Record<string, number>;
  destaque: boolean;
  categoria_id?: string;
  categoria?: { nome: string; slug: string };
  unidade_nome?: string;
  is_kit?: boolean;
  kit_itens?: KitItem[];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface ProdutoPageProps {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
}

export default function ProdutoPage({ cart, setCart }: ProdutoPageProps) {
  const { slug } = useParams<{ slug: string }>();
  usePageAnalytics('/loja/produto', `Produto${slug ? ': ' + slug : ''}`);
  const navigate = useNavigate();

  const [produto, setProduto] = useState<Produto | null>(null);

  useEffect(() => {
    if (produto) {
      document.title = `${produto.nome} — Loja Sport for Kids`;
    } else {
      document.title = 'Produto — Loja Sport for Kids';
    }
  }, [produto]);
  const [loading, setLoading] = useState(true);
  const [imagemAtiva, setImagemAtiva] = useState(0);
  const [quantidade, setQuantidade] = useState(1);
  const [varianteSelecionada, setVarianteSelecionada] = useState<Record<string, string>>({});
  const [kitComponentSelecionado, setKitComponentSelecionado] = useState<Record<string, Record<string, string>>>({});
  const [adicionado, setAdicionado] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`/api/loja/produtos/${slug}`)
      .then(r => r.json())
      .then(data => {
        const prod = data.produto || null;
        setProduto(prod);
        // Pre-select first option of each variant
        if (prod?.variantes) {
          const defaults: Record<string, string> = {};
          for (const v of prod.variantes) {
            if (v.opcoes.length > 0) defaults[v.tipo] = v.opcoes[0];
          }
          setVarianteSelecionada(defaults);
        }

        // Initialize kit component selections defaults
        if (prod?.is_kit && prod.kit_itens) {
          const kitDefaults: Record<string, Record<string, string>> = {};
          for (const item of prod.kit_itens) {
            if (item.componente_variante_key === 'default' && item.componente?.variantes) {
              const compDefaults: Record<string, string> = {};
              for (const v of item.componente.variantes) {
                if (v.opcoes.length > 0) compDefaults[v.tipo] = v.opcoes[0];
              }
              kitDefaults[item.componente_produto_id] = compDefaults;
            }
          }
          setKitComponentSelecionado(kitDefaults);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  const handleAddToCart = (): boolean => {
    if (!produto) return false;

    const finalVarianteSelecionada = { ...varianteSelecionada };

    if (produto.is_kit && produto.kit_itens) {
      for (const item of produto.kit_itens) {
        if (item.componente_variante_key === 'default' && item.componente?.variantes && item.componente.variantes.length > 0) {
          const compSelections = kitComponentSelecionado[item.componente_produto_id] || {};
          for (const v of item.componente.variantes) {
            if (!compSelections[v.tipo]) {
              alert(`Por favor, selecione a variante de ${v.tipo} para o produto ${item.componente.nome}`);
              return false;
            }
          }
          const combined = item.componente.variantes.map(v => compSelections[v.tipo]).join(' - ');
          // We save both keys: the ID for backend/stock logic, and the Name for UI display
          finalVarianteSelecionada[item.componente_produto_id] = combined;
          finalVarianteSelecionada[item.componente.nome] = combined;
        }
      }
    } else {
      if (produto.variantes && produto.variantes.length > 0) {
        for (const v of produto.variantes) {
          if (!finalVarianteSelecionada[v.tipo]) {
            alert(`Por favor, selecione uma opção para ${v.tipo}`);
            return false;
          }
        }
      }
    }

    const key = `${produto.id}-${JSON.stringify(finalVarianteSelecionada)}`;
    setCart(prev => {
      const existing = prev.find(i => i.key === key);
      if (existing) {
        return prev.map(i => i.key === key ? { ...i, quantidade: i.quantidade + quantidade } : i);
      }
      return [...prev, { produto, quantidade, variante_selecionada: finalVarianteSelecionada, key }];
    });
    setAdicionado(true);
    setTimeout(() => setAdicionado(false), 2000);
    return true;
  };

  const handleBuyNow = () => {
    const success = handleAddToCart();
    if (success) {
      navigate('/loja/checkout');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!produto) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <Package size={48} className="text-slate-300" />
        <h2 className="text-xl font-bold text-slate-700">Produto não encontrado</h2>
        <Link to="/loja" className="text-indigo-600 font-medium hover:underline">Voltar à loja</Link>
      </div>
    );
  }

  const hasPromo = produto.preco_promocional && produto.preco_promocional < produto.preco;
  const precoExibido = hasPromo ? produto.preco_promocional! : produto.preco;
  const desconto = hasPromo ? Math.round((1 - produto.preco_promocional! / produto.preco) * 100) : 0;

  const getEstoqueAtual = () => {
    if (!produto) return 0;
    if (!produto.is_kit) {
      const varianteKey = Object.values(varianteSelecionada).join(' - ');
      return produto.estoque_por_variante?.[varianteKey] ?? produto.estoque_por_variante?.['default'] ?? 999;
    }
    
    // For kits, the stock is determined by the minimum stock of its components
    if (!produto.kit_itens || produto.kit_itens.length === 0) return 0;
    
    const componentStocks = produto.kit_itens.map(item => {
      const comp = item.componente;
      if (!comp) return 0;
      
      let variantKey = 'default';
      if (item.componente_variante_key && item.componente_variante_key !== 'default') {
        variantKey = item.componente_variante_key;
      } else if (comp.variantes && comp.variantes.length > 0) {
        const compSelections = kitComponentSelecionado[item.componente_produto_id] || {};
        variantKey = comp.variantes.map(v => compSelections[v.tipo]).join(' - ');
      }
      
      const stock = comp.estoque_por_variante?.[variantKey] ?? comp.estoque_por_variante?.['default'] ?? 0;
      return Math.floor(stock / item.quantidade);
    });
    
    return Math.min(...componentStocks);
  };

  const estoqueAtual = getEstoqueAtual();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center gap-1.5 text-sm text-slate-500">
            <Link to="/" className="hover:text-indigo-600 transition-colors">Início</Link>
            <ChevronRight size={14} />
            <Link to="/loja" className="hover:text-indigo-600 transition-colors">Loja</Link>
            {produto.categoria && (
              <>
                <ChevronRight size={14} />
                <Link to={`/loja?categoria=${produto.categoria.slug}`} className="hover:text-indigo-600 transition-colors">
                  {produto.categoria.nome}
                </Link>
              </>
            )}
            <ChevronRight size={14} />
            <span className="text-slate-800 font-medium truncate">{produto.nome}</span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link to="/loja" className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-600 transition-colors text-sm mb-6">
          <ChevronLeft size={16} />
          Voltar à loja
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {/* Images */}
          <div>
            <div className="relative aspect-square bg-white rounded-2xl overflow-hidden border border-slate-100 mb-3 shadow-sm">
              {produto.imagens?.[imagemAtiva] ? (
                <img
                  src={produto.imagens[imagemAtiva]}
                  alt={produto.nome}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-3">
                  <Package size={64} />
                  <p className="text-sm">Sem imagem</p>
                </div>
              )}
              {produto.destaque && (
                <div className="absolute top-4 left-4 bg-amber-400 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Star size={11} fill="currentColor" /> Destaque
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {produto.imagens.length > 1 && (
              <div className="flex gap-2">
                {produto.imagens.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setImagemAtiva(i)}
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${i === imagemAtiva ? 'border-indigo-500 shadow-md' : 'border-slate-200 hover:border-indigo-300'}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="flex flex-col">
            <div className="flex-1">
              {produto.unidade_nome && (
                <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-2">{produto.unidade_nome}</p>
              )}
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight mb-3">{produto.nome}</h1>

              {/* Price */}
              <div className="mb-6">
                {hasPromo && (
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-slate-400 line-through text-lg">{formatCurrency(produto.preco)}</span>
                    <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">-{desconto}%</span>
                  </div>
                )}
                <span className="text-3xl font-black text-slate-900">{formatCurrency(precoExibido)}</span>
                {hasPromo && (
                  <p className="text-emerald-600 text-sm font-medium mt-1">
                    Economia de {formatCurrency(produto.preco - precoExibido)}
                  </p>
                )}
              </div>

              {/* Description */}
              {produto.descricao && (
                <p className="text-slate-600 leading-relaxed mb-6">{produto.descricao}</p>
              )}

              {/* Kit Components Presentation */}
              {produto.is_kit && produto.kit_itens && produto.kit_itens.length > 0 && (
                <div className="mb-6 bg-slate-50 border border-slate-100 rounded-2xl p-4">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Package size={16} className="text-indigo-600" />
                    Produtos inclusos neste Kit:
                  </h3>
                  <div className="space-y-4">
                    {produto.kit_itens.map(item => {
                      const comp = item.componente;
                      if (!comp) return null;
                      const hasDynamicVariants = item.componente_variante_key === 'default' && comp.variantes && comp.variantes.length > 0;
                      return (
                        <div key={item.id} className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-semibold text-slate-800 text-sm">{comp.nome}</p>
                              {item.componente_variante_key !== 'default' ? (
                                <p className="text-xs text-indigo-600 font-semibold mt-0.5">Opção: {item.componente_variante_key}</p>
                              ) : comp.variantes && comp.variantes.length > 0 ? (
                                <p className="text-xs text-amber-600 font-semibold mt-0.5">⚠️ Selecione as opções abaixo</p>
                              ) : (
                                <p className="text-xs text-slate-400 mt-0.5">Padrão (sem variantes)</p>
                              )}
                            </div>
                            <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2 py-1 rounded-lg">
                              Qtd: {item.quantidade}
                            </span>
                          </div>

                          {/* Dynamic Variants Selectors */}
                          {hasDynamicVariants && (
                            <div className="mt-3 pt-3 border-t border-slate-50 space-y-2">
                              {comp.variantes.map(v => {
                                const selectedVal = kitComponentSelecionado[item.componente_produto_id]?.[v.tipo] || '';
                                return (
                                  <div key={v.tipo} className="flex flex-col gap-1.5">
                                    <span className="text-xs font-bold text-slate-500 uppercase">{v.tipo}:</span>
                                    <div className="flex flex-wrap gap-1.5">
                                      {v.opcoes.map(opt => {
                                        const isSel = selectedVal === opt;
                                        return (
                                          <button
                                            key={opt}
                                            type="button"
                                            onClick={() => {
                                              setKitComponentSelecionado(prev => ({
                                                ...prev,
                                                [item.componente_produto_id]: {
                                                  ...(prev[item.componente_produto_id] || {}),
                                                  [v.tipo]: opt
                                                }
                                              }));
                                            }}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border-2 transition-all ${
                                              isSel
                                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm'
                                                : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'
                                            }`}
                                          >
                                            {opt}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Variants */}
              {produto.variantes.map(variante => (
                <div key={variante.tipo} className="mb-5">
                  <p className="text-sm font-semibold text-slate-700 mb-2 capitalize">
                    {variante.tipo}: <span className="text-indigo-600">{varianteSelecionada[variante.tipo]}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {variante.opcoes.map(opcao => {
                      const isSelected = varianteSelecionada[variante.tipo] === opcao;
                      return (
                        <button
                          key={opcao}
                          onClick={() => setVarianteSelecionada(prev => ({ ...prev, [variante.tipo]: opcao }))}
                          className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md shadow-indigo-100'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'
                          }`}
                        >
                          {opcao}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Quantity */}
              <div className="mb-6">
                <p className="text-sm font-semibold text-slate-700 mb-2">Quantidade</p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center border-2 border-slate-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setQuantidade(q => Math.max(1, q - 1))}
                      className="p-3 hover:bg-slate-50 transition-colors"
                    >
                      <Minus size={16} className="text-slate-600" />
                    </button>
                    <span className="px-5 py-3 font-bold text-slate-800 text-lg">{quantidade}</span>
                    <button
                      onClick={() => setQuantidade(q => Math.min(estoqueAtual, q + 1))}
                      className="p-3 hover:bg-slate-50 transition-colors"
                    >
                      <Plus size={16} className="text-slate-600" />
                    </button>
                  </div>
                  {estoqueAtual < 5 && estoqueAtual > 0 && (
                    <p className="text-amber-600 text-sm font-medium">⚠️ Apenas {estoqueAtual} em estoque</p>
                  )}
                  {estoqueAtual === 0 && (
                    <p className="text-red-500 text-sm font-medium">Indisponível</p>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-3">
              <motion.button
                onClick={handleBuyNow}
                disabled={estoqueAtual === 0}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-200 text-base"
              >
                Comprar Agora
                <ArrowRight size={18} />
              </motion.button>

              <motion.button
                onClick={handleAddToCart}
                disabled={estoqueAtual === 0}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all border-2 text-base ${
                  adicionado
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                    : 'bg-white border-indigo-300 text-indigo-700 hover:bg-indigo-50'
                }`}
              >
                {adicionado ? <><Check size={18} /> Adicionado!</> : <><ShoppingCart size={18} /> Adicionar ao Carrinho</>}
              </motion.button>
            </div>

            {/* Delivery info */}
            <div className="mt-6 bg-slate-50 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span>🏫</span>
                <span><strong>Retirada</strong> disponível na unidade</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span>🔒</span>
                <span>Pagamento seguro via Pagar.me</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
