import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { ShoppingCart, Search, Filter, Star, ChevronRight, X, Minus, Plus, Package, Tag, Sparkles, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePageAnalytics } from '../../hooks/usePageAnalytics';

interface Categoria {
  id: string;
  nome: string;
  slug: string;
  descricao?: string;
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
  unidade_nome?: string;
  is_kit?: boolean;
}

export interface CartItem {
  produto: Produto;
  quantidade: number;
  variante_selecionada: Record<string, string>;
  key: string;
}

interface LojaPageProps {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function ProductCard({ produto, onAddToCart }: { produto: Produto; onAddToCart: (p: Produto) => void }) {
  const hasPromo = produto.preco_promocional && produto.preco_promocional < produto.preco;
  const precoExibido = hasPromo ? produto.preco_promocional! : produto.preco;
  const desconto = hasPromo ? Math.round((1 - produto.preco_promocional! / produto.preco) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-slate-100 group"
    >
      <Link to={`/loja/produto/${produto.slug}`} className="block">
        <div className="relative aspect-square bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
          {produto.imagens?.[0] ? (
            <img
              src={produto.imagens[0]}
              alt={produto.nome}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package size={48} className="text-slate-300" />
            </div>
          )}
          {produto.destaque && (
            <div className="absolute top-3 left-3 bg-amber-400 text-amber-900 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
              <Star size={10} fill="currentColor" /> Destaque
            </div>
          )}
          {hasPromo && (
            <div className="absolute top-3 right-3 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              -{desconto}%
            </div>
          )}
        </div>
      </Link>

      <div className="p-4">
        <Link to={`/loja/produto/${produto.slug}`}>
          <h3 className="font-semibold text-slate-800 text-sm leading-tight mb-1 hover:text-indigo-600 transition-colors line-clamp-2">
            {produto.nome}
          </h3>
        </Link>
        {produto.unidade_nome && (
          <p className="text-xs text-slate-400 mb-2">{produto.unidade_nome}</p>
        )}

        <div className="flex items-end justify-between mt-3">
          <div>
            {hasPromo && (
              <p className="text-xs text-slate-400 line-through">{formatCurrency(produto.preco)}</p>
            )}
            <p className="text-lg font-bold text-slate-900">{formatCurrency(precoExibido)}</p>
          </div>
          <button
            onClick={() => onAddToCart(produto)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-all active:scale-95 flex items-center gap-1"
          >
            <ShoppingCart size={14} />
            Adicionar
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function CartDrawer({ cart, setCart, onCheckout }: { cart: CartItem[]; setCart: React.Dispatch<React.SetStateAction<CartItem[]>>; onCheckout: () => void }) {
  const [isOpen, setIsOpen] = useState(false);

  const total = cart.reduce((acc, item) => {
    const preco = item.produto.preco_promocional && item.produto.preco_promocional < item.produto.preco
      ? item.produto.preco_promocional
      : item.produto.preco;
    return acc + preco * item.quantidade;
  }, 0);

  const updateQty = (key: string, delta: number) => {
    setCart(prev => prev.map(i => i.key === key ? { ...i, quantidade: Math.max(1, i.quantidade + delta) } : i));
  };

  const removeItem = (key: string) => {
    setCart(prev => prev.filter(i => i.key !== key));
  };

  return (
    <>
      {/* Floating cart button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-indigo-600 text-white rounded-2xl px-4 py-3 shadow-xl shadow-indigo-200 flex items-center gap-2 font-semibold text-sm hover:bg-indigo-700 transition-all z-40"
      >
        <ShoppingCart size={20} />
        {cart.length > 0 && (
          <span className="bg-white text-indigo-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
            {cart.reduce((a, i) => a + i.quantidade, 0)}
          </span>
        )}
        <span>{cart.length === 0 ? 'Carrinho' : formatCurrency(total)}</span>
      </button>

      {/* Drawer overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ShoppingCart size={20} className="text-indigo-600" />
                  Carrinho
                  {cart.length > 0 && (
                    <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">
                      {cart.reduce((a, i) => a + i.quantidade, 0)} itens
                    </span>
                  )}
                </h2>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X size={20} className="text-slate-500" />
                </button>
              </div>

              {/* Items */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {cart.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <ShoppingCart size={28} className="text-slate-400" />
                    </div>
                    <p className="text-slate-500 font-medium">Carrinho vazio</p>
                    <p className="text-slate-400 text-sm mt-1">Adicione produtos para continuar</p>
                  </div>
                ) : (
                  cart.map(item => {
                    const preco = item.produto.preco_promocional && item.produto.preco_promocional < item.produto.preco
                      ? item.produto.preco_promocional : item.produto.preco;
                    return (
                      <div key={item.key} className="flex gap-3 bg-slate-50 rounded-xl p-3">
                        <div className="w-16 h-16 bg-slate-200 rounded-lg overflow-hidden flex-shrink-0">
                          {item.produto.imagens?.[0] ? (
                            <img src={item.produto.imagens[0]} alt={item.produto.nome} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package size={24} className="text-slate-400" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-sm line-clamp-2">{item.produto.nome}</p>
                          {Object.entries(item.variante_selecionada).filter(([k]) => k.length !== 36).map(([k, v]) => (
                            <p key={k} className="text-xs text-slate-500 capitalize">{k}: {v}</p>
                          ))}
                          <p className="text-indigo-600 font-bold text-sm mt-1">{formatCurrency(preco * item.quantidade)}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <button onClick={() => removeItem(item.key)} className="text-slate-400 hover:text-red-500 transition-colors">
                            <X size={14} />
                          </button>
                          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg">
                            <button onClick={() => updateQty(item.key, -1)} className="p-1 hover:bg-slate-50 rounded-l-lg">
                              <Minus size={12} className="text-slate-600" />
                            </button>
                            <span className="px-2 text-xs font-bold text-slate-800">{item.quantidade}</span>
                            <button onClick={() => updateQty(item.key, 1)} className="p-1 hover:bg-slate-50 rounded-r-lg">
                              <Plus size={12} className="text-slate-600" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              {cart.length > 0 && (
                <div className="p-6 border-t border-slate-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Total</span>
                    <span className="text-2xl font-bold text-slate-900">{formatCurrency(total)}</span>
                  </div>
                  <Link
                    to="/loja/checkout"
                    onClick={() => setIsOpen(false)}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-200"
                  >
                    Finalizar Pedido
                    <ArrowRight size={18} />
                  </Link>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default function LojaPage({ cart, setCart }: LojaPageProps) {
  usePageAnalytics('/loja', 'Loja');

  useEffect(() => {
    document.title = "Loja Oficial — Sport for Kids";
  }, []);
  const navigate = useNavigate();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  const categoriaAtiva = searchParams.get('categoria') || '';
  const busca = searchParams.get('q') || '';
  const [buscaInput, setBuscaInput] = useState(busca);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, prodRes] = await Promise.all([
        fetch('/api/loja/categorias').then(r => r.json()),
        fetch(`/api/loja/produtos?categoria=${categoriaAtiva}&q=${busca}`).then(r => r.json())
      ]);
      setCategorias(catRes.categorias || []);
      setProdutos(prodRes.produtos || []);
    } catch (err) {
      console.error('Erro ao carregar loja:', err);
    } finally {
      setLoading(false);
    }
  }, [categoriaAtiva, busca]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddToCart = (produto: Produto) => {
    if (produto.is_kit) {
      navigate(`/loja/produto/${produto.slug}`);
      return;
    }
    const key = `${produto.id}-${JSON.stringify({})}`;
    setCart(prev => {
      const existing = prev.find(i => i.key === key);
      if (existing) {
        return prev.map(i => i.key === key ? { ...i, quantidade: i.quantidade + 1 } : i);
      }
      return [...prev, { produto, quantidade: 1, variante_selecionada: {}, key }];
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams(searchParams);
    if (buscaInput) p.set('q', buscaInput); else p.delete('q');
    setSearchParams(p);
  };

  const destaques = produtos.filter(p => p.destaque);
  const listagem = categoriaAtiva || busca ? produtos : produtos;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="flex items-center gap-2 text-indigo-200 text-sm mb-3">
            <Link to={localStorage.getItem('last_unit_slug') ? `/portal/${localStorage.getItem('last_unit_slug')}` : '/'} className="hover:text-white transition-colors">Início</Link>
            <ChevronRight size={14} />
            <span>Loja</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold mb-2">Loja Sport for Kids</h1>
          <p className="text-indigo-200 text-lg">Uniformes, acessórios e kits para as aulas</p>

          {/* Search */}
          <form onSubmit={handleSearch} className="mt-6 flex gap-3 max-w-lg">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={buscaInput}
                onChange={e => setBuscaInput(e.target.value)}
                placeholder="Buscar produtos..."
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/10 backdrop-blur border border-white/20 text-white placeholder-indigo-200 focus:outline-none focus:ring-2 focus:ring-white/30"
              />
            </div>
            <button
              type="submit"
              className="bg-white text-indigo-600 font-bold px-5 py-3 rounded-xl hover:bg-indigo-50 transition-colors"
            >
              Buscar
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-8 scrollbar-hide">
          <button
            onClick={() => { const p = new URLSearchParams(searchParams); p.delete('categoria'); setSearchParams(p); }}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${!categoriaAtiva ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
          >
            Todos
          </button>
          {categorias.map(cat => (
            <button
              key={cat.id}
              onClick={() => { const p = new URLSearchParams(searchParams); p.set('categoria', cat.slug); setSearchParams(p); }}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${categoriaAtiva === cat.slug ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
            >
              {cat.nome}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse">
                <div className="aspect-square bg-slate-100" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-slate-100 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                  <div className="h-6 bg-slate-100 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : listagem.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <Package size={36} className="text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-700 mb-2">Nenhum produto encontrado</h3>
            <p className="text-slate-400">Tente outra categoria ou busca</p>
          </div>
        ) : (
          <>
            {/* Destaques (only on home) */}
            {!categoriaAtiva && !busca && destaques.length > 0 && (
              <div className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles size={20} className="text-amber-500" />
                  <h2 className="text-lg font-bold text-slate-800">Destaques</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {destaques.map(p => (
                    <ProductCard key={p.id} produto={p} onAddToCart={handleAddToCart} />
                  ))}
                </div>
                <div className="border-t border-slate-200 my-8" />
                <div className="flex items-center gap-2 mb-4">
                  <Tag size={20} className="text-indigo-500" />
                  <h2 className="text-lg font-bold text-slate-800">Todos os Produtos</h2>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {listagem.map(p => (
                <ProductCard key={p.id} produto={p} onAddToCart={handleAddToCart} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Cart */}
      <CartDrawer
        cart={cart}
        setCart={setCart}
        onCheckout={() => {}}
      />
    </div>
  );
}
