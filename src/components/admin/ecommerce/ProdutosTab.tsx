import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Search, Edit, Edit2, Trash2, Tag, Archive, Package, 
  Upload, X, Check, Image as ImageIcon, Box, Truck 
} from 'lucide-react';
import { useAdminStore } from '../../../stores/adminStore';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';

interface Produto {
  id: string;
  nome: string;
  slug: string;
  descricao: string;
  preco: number;
  preco_promocional?: number | null;
  categoria_id: string;
  destaque: boolean;
  is_destaque?: boolean;
  kit_itens?: any[];
  status: string;
  is_kit: boolean;
  variantes: any[];
  estoque_por_variante: any;
  peso_kg: number;
  comprimento_cm: number;
  largura_cm: number;
  altura_cm: number;
  imagens: string[];
}

interface Categoria {
  id: string;
  nome: string;
  slug: string;
}

function getCombinations(variantes: { tipo: string; opcoes: string[] }[]): string[] {
  if (!variantes || variantes.length === 0) return ['default'];
  
  let results: string[][] = [[]];
  for (const variant of variantes) {
    const nextResults: string[][] = [];
    for (const res of results) {
      for (const opt of variant.opcoes) {
        nextResults.push([...res, opt]);
      }
    }
    results = nextResults;
  }
  
  return results.map(r => r.join(' - '));
}


export function ProdutosTab() {
  const { produtos, setProdutos, categorias, loading, setLoading, loadData } = useAdminStore();
  

  const [entradaVarianteKey, setEntradaVarianteKey] = useState<string>('default');
  const [entradaQuantidade, setEntradaQuantidade] = useState<number>(0);
  const [entradaData, setEntradaData] = useState<string>('');

  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [produtoForm, setProdutoForm] = useState<Partial<Produto>>({
    nome: '', slug: '', descricao: '', preco: 0, preco_promocional: undefined,
    categoria_id: '', destaque: false, status: 'ativo',
    is_kit: false, variantes: [], estoque_por_variante: {},
    peso_kg: 0.5, comprimento_cm: 20, largura_cm: 15, altura_cm: 5, imagens: []
  });
  
  const [lojaProdutosSubTab, setLojaProdutosSubTab] = useState<'catalogo' | 'estoque'>('catalogo');
  const [estoqueHistorico, setEstoqueHistorico] = useState<any[]>([]);
  const [loadingEstoqueHistorico, setLoadingEstoqueHistorico] = useState(false);
  const [estoqueFilterProduto, setEstoqueFilterProduto] = useState<string>('all');
  const [estoqueFilterStartDate, setEstoqueFilterStartDate] = useState<string>('');
  const [estoqueFilterEndDate, setEstoqueFilterEndDate] = useState<string>('');
  const [searchProduto, setSearchProduto] = useState('');
  
  const [imagensInputText, setImagensInputText] = useState('');
  const [newVariantType, setNewVariantType] = useState('');
  const [newVariantOptions, setNewVariantOptions] = useState('');
  const [variantTypeInput, setVariantTypeInput] = useState('');
  const [variantOptionsInput, setVariantOptionsInput] = useState('');
  const [addStockQty, setAddStockQty] = useState<Record<string, number>>({});
  const [addStockDate, setAddStockDate] = useState<Record<string, string>>({});
  const [kitItens, setKitItens] = useState<any[]>([]);
  const [selectedKitComponentProduct, setSelectedKitComponentProduct] = useState<string>('');
  const [selectedKitComponentVariant, setSelectedKitComponentVariant] = useState<string>('default');
  const [selectedKitComponentQty, setSelectedKitComponentQty] = useState<number>(1);
  const [loadingAction, setLoadingAction] = useState(false);

  // DRAG AND DROP STATES
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (lojaProdutosSubTab === 'estoque' && estoqueHistorico.length === 0 && !loadingEstoqueHistorico) {
      fetchStockHistory();
    }
  }, [lojaProdutosSubTab]);

  const fetchStockHistory = async () => {
    setLoadingEstoqueHistorico(true);
    try {
      const res = await fetch('/api/admin/loja/estoque/historico', {
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('admin_token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEstoqueHistorico(data.historico || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEstoqueHistorico(false);
    }
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = sessionStorage.getItem('admin_token');
    const headers = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };

    try {
      let finalVariantes = [...(produtoForm.variantes || [])];
      if (variantTypeInput.trim() && variantOptionsInput.trim()) {
        const tipo = variantTypeInput.trim();
        const opcoes = variantOptionsInput.split(',').map(o => o.trim()).filter(Boolean);
        const alreadyIdx = finalVariantes.findIndex(v => v.tipo.toLowerCase() === tipo.toLowerCase());
        if (alreadyIdx >= 0) {
          finalVariantes[alreadyIdx].opcoes = Array.from(new Set([...finalVariantes[alreadyIdx].opcoes, ...opcoes]));
        } else {
          finalVariantes.push({ tipo, opcoes });
        }
        // Limpar caso não tenha sido limpo
        setVariantTypeInput('');
        setVariantOptionsInput('');
      }

      const payload = {
        ...produtoForm,
        variantes: finalVariantes,
        imagens: imagensInputText.split(',').map(img => img.trim()).filter(Boolean),
        preco: Number(produtoForm.preco),
        preco_promocional: produtoForm.preco_promocional ? Number(produtoForm.preco_promocional) : null
      };

      const url = selectedId ? `/api/admin/loja/produtos/${selectedId}` : '/api/admin/loja/produtos';
      const method = selectedId ? 'PUT' : 'POST';

      const res = await fetch(url, { method, headers, body: JSON.stringify(payload) });
      const savedProd = await res.json();
      if (!res.ok) throw new Error(savedProd.error || 'Erro ao salvar produto.');

      // Save kit items if applicable
      if (produtoForm.is_kit) {
        const prodId = selectedId || savedProd.id;
        const payloadKits = kitItens.map(item => ({
          componente_produto_id: item.produto_id,
          componente_variante_key: item.variante || 'default',
          quantidade: item.quantidade
        }));
        await fetch(`/api/admin/loja/produtos/${prodId}/kit-itens`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payloadKits)
        });
      }

      toast.success('Produto salvo com sucesso!');
      setIsEditing(false);
      setSelectedId(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar produto.');
    }
  };

  const handleStockAddition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    if (entradaQuantidade === 0) {
      toast.error('A quantidade não pode ser zero.');
      return;
    }

    const token = sessionStorage.getItem('admin_token');
    const headers = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };

    try {
      const res = await fetch(`/api/admin/loja/produtos/${selectedId}/estoque/adicionar`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          variante_key: entradaVarianteKey,
          quantidade: entradaQuantidade,
          data_registro: entradaData,
          motivo: entradaQuantidade < 0 ? 'ajuste' : 'adicao'
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(entradaQuantidade < 0 ? 'Ajuste de estoque realizado com sucesso!' : 'Entrada de estoque realizada com sucesso!');
        if (data.estoque) {
          setProdutoForm(prev => ({
            ...prev,
            estoque_por_variante: data.estoque
          }));
        }
        setEntradaQuantidade(0);
        setEntradaData(new Date().toISOString().split('T')[0]);
        fetchStockHistory(selectedId);
        loadData();
      } else {
        toast.error(data.error || 'Erro ao registrar estoque.');
      }
    } catch (err) {
      toast.error('Erro de conexão ao registrar estoque.');
    }
  };

  const handleReorderProdutos = async (newOrder: Produto[]) => {
    setProdutos(newOrder);
    const orderPayload = newOrder.map((p, index) => ({ id: p.id, ordem: index }));
    const token = sessionStorage.getItem('admin_token');
    const headers = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
    try {
      await fetch('/api/admin/loja/produtos/reorder', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ order: orderPayload })
      });
      toast.success('Ordem atualizada com sucesso!');
    } catch {
      toast.error('Erro ao salvar nova ordem');
    }
  };






  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const list = [...(options.turmas || [])];
    const draggedIndex = list.findIndex(t => t.id === draggedId);
    const targetIndex = list.findIndex(t => t.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Move item
    const [draggedItem] = list.splice(draggedIndex, 1);
    list.splice(targetIndex, 0, draggedItem);

    // Update order value for each item in the list
    const updatedList = list.map((item, idx) => ({
      ...item,
      ordem: idx
    }));

    // Update local state immediately for snappy UI
    setOptions((prev: any) => ({
      ...prev,
      turmas: updatedList
    }));

    setDraggedId(null);

    // Send update to the backend
    try {
      const orders = updatedList.map((item, idx) => ({
        id: item.id,
        ordem: idx
      }));

      const res = await fetch('/api/options/turmas/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('admin_token')}`
        },
        body: JSON.stringify({ orders })
      });

      if (res.ok) {
        toast.success('Ordem das turmas atualizada com sucesso!');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Erro ao salvar nova ordenação no servidor.');
        loadData();
      }
    } catch (err) {
      console.error('Error saving order:', err);
      toast.error('Erro de conexão ao salvar ordenação.');
      loadData();
    }
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };


  // Filter products for the list
  const filteredProducts = produtos.filter((p: any) => 
    p.nome.toLowerCase().includes(searchProduto.toLowerCase()) || 
    p.slug.toLowerCase().includes(searchProduto.toLowerCase())
  );


  const handleEditProduto = (produto) => {
    setProdutoForm(produto);
    setSelectedId(produto.id);
    setImagensInputText(produto.imagens?.join(', ') || '');
    setKitItens(produto.kit_itens || []);
    setIsEditing(true);
  };

  const handleDeleteProduto = async (id) => {
    if (!confirm('Deseja excluir este produto?')) return;
    const token = sessionStorage.getItem('admin_token');
    const res = await fetch(`/api/admin/loja/produtos/${id}`, {
      method: 'DELETE',
      headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
    });
    if (res.ok) {
      toast.success('Produto excluído!');
      loadData();
    } else {
      toast.error('Erro ao excluir produto');
    }
  };

  return (

    <>
      {/* MODAL DE PRODUTOS */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsEditing(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
              <h3 className="text-xl font-black text-slate-800">
                {selectedId ? 'Editar Produto' : 'Novo Produto'}
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(100vh-200px)]">

                <>
                  <form id="product-edit-form" onSubmit={handleProductSubmit} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Produto</label>
                      <input type="text" required value={produtoForm.nome || ''} onChange={e => setProdutoForm({ ...produtoForm, nome: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Slug (URL)</label>
                      <input type="text" required value={produtoForm.slug || ''} onChange={e => setProdutoForm({ ...produtoForm, slug: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição</label>
                    <textarea value={produtoForm.descricao || ''} onChange={e => setProdutoForm({ ...produtoForm, descricao: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm h-24 focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Preço Normal (R$)</label>
                      <input type="number" step="0.01" required value={produtoForm.preco || ''} onChange={e => setProdutoForm({ ...produtoForm, preco: Number(e.target.value) })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Preço Promocional (R$)</label>
                      <input type="number" step="0.01" value={produtoForm.preco_promocional || ''} onChange={e => setProdutoForm({ ...produtoForm, preco_promocional: e.target.value ? Number(e.target.value) : undefined })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoria</label>
                      <select required value={produtoForm.categoria_id || ''} onChange={e => setProdutoForm({ ...produtoForm, categoria_id: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                        <option value="">Selecione...</option>
                        {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Imagens */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-3">
                    <h4 className="font-bold text-slate-800 text-sm">Imagens do Produto</h4>
                    <p className="text-xs text-slate-400">Insira as URLs das imagens separadas por vírgula. A primeira será usada como imagem principal.</p>
                    <textarea
                      placeholder="https://cdn.exemplo.com/img1.jpg, https://cdn.exemplo.com/img2.jpg"
                      value={imagensInputText}
                      onChange={e => setImagensInputText(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm h-20 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    {imagensInputText.split(',').map(u => u.trim()).filter(Boolean).length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {imagensInputText.split(',').map((url, idx) => url.trim() ? (
                          <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
                            <img src={url.trim()} alt={`img-${idx}`} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="%23f1f5f9"/><text x="50%" y="50%" font-size="10" text-anchor="middle" dy=".3em" fill="%2394a3b8">img</text></svg>'; }} />
                            {idx === 0 && <span className="absolute bottom-0 left-0 right-0 bg-indigo-600/80 text-white text-[8px] text-center font-bold py-0.5">Principal</span>}
                          </div>
                        ) : null)}
                      </div>
                    )}
                  </div>

                  {/* Destaque Checkbox */}
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <input
                      type="checkbox"
                      id="destaque"
                      checked={produtoForm.destaque || false}
                      onChange={e => setProdutoForm({ ...produtoForm, destaque: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                    />
                    <label htmlFor="destaque" className="text-xs font-bold text-slate-700 cursor-pointer">
                      Destacar este produto na página principal da loja (Destaque)
                    </label>
                  </div>

                  {/* Variantes & Estoque */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-5">
                    <h4 className="font-bold text-slate-800 text-sm">Configuração de Variantes & Estoque</h4>
                    
                    {/* Add Variant Form */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
                      <h5 className="text-xs font-bold text-slate-500 uppercase">Adicionar Variável (Ex: Tamanho, Cor)</h5>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tipo da Variante</label>
                          <input 
                            type="text" 
                            placeholder="Ex: Tamanho" 
                            value={variantTypeInput}
                            onChange={e => setVariantTypeInput(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Opções (separadas por vírgula)</label>
                          <input 
                            type="text" 
                            placeholder="Ex: P, M, G" 
                            value={variantOptionsInput}
                            onChange={e => setVariantOptionsInput(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!variantTypeInput.trim() || !variantOptionsInput.trim()) return;
                          const tipo = variantTypeInput.trim();
                          const opcoes = variantOptionsInput.split(',').map(o => o.trim()).filter(Boolean);
                          const currentVars = [...(produtoForm.variantes || [])];
                          
                          const alreadyIdx = currentVars.findIndex(v => v.tipo.toLowerCase() === tipo.toLowerCase());
                          if (alreadyIdx >= 0) {
                            currentVars[alreadyIdx].opcoes = Array.from(new Set([...currentVars[alreadyIdx].opcoes, ...opcoes]));
                          } else {
                            currentVars.push({ tipo, opcoes });
                          }
                          
                          setProdutoForm({ ...produtoForm, variantes: currentVars });
                          setVariantTypeInput('');
                          setVariantOptionsInput('');
                        }}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs"
                      >
                        Adicionar Variante
                      </button>
                    </div>

                    {/* Variations list */}
                    {(produtoForm.variantes || []).length > 0 && (
                      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                        <h5 className="text-xs font-bold text-slate-500 uppercase">Variantes Definidas</h5>
                        <div className="space-y-2">
                          {produtoForm.variantes.map((v, idx) => (
                            <div key={idx} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                              <div>
                                <span className="font-bold text-slate-700">{v.tipo}: </span>
                                <span className="text-slate-500">{v.opcoes.join(', ')}</span>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setVariantTypeInput(v.tipo);
                                    setVariantOptionsInput(v.opcoes.join(', '));
                                    const updated = (produtoForm.variantes || []).filter((_, i) => i !== idx);
                                    setProdutoForm({ ...produtoForm, variantes: updated });
                                  }}
                                  className="text-indigo-500 hover:text-indigo-700 p-1"
                                  title="Editar Variante"
                                >
                                  <Edit size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = (produtoForm.variantes || []).filter((_, i) => i !== idx);
                                    setProdutoForm({ ...produtoForm, variantes: updated });
                                  }}
                                  className="text-red-500 hover:text-red-700 p-1"
                                  title="Excluir Variante"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Stock Config for each combination */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                      <div className="flex justify-between items-center">
                        <h5 className="text-xs font-bold text-slate-500 uppercase">
                          {selectedId ? 'Estoque Atual por Combinação' : 'Estoque Inicial por Combinação'}
                        </h5>
                        {selectedId && (
                          <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-medium">
                            Apenas leitura na edição
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                        {getCombinations(produtoForm.variantes || []).map((comb) => (
                          <div key={comb} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-150">
                            <span className="text-xs font-bold text-slate-600 truncate max-w-[200px]" title={comb === 'default' ? 'Estoque Geral (Sem Variante)' : comb}>
                              {comb === 'default' ? 'Estoque Geral' : comb}
                            </span>
                            <input 
                              type="number"
                              min={0}
                              readOnly={!!selectedId}
                              disabled={!!selectedId}
                              value={produtoForm.estoque_por_variante?.[comb] ?? 0}
                              onChange={e => {
                                if (selectedId) return;
                                const qty = Number(e.target.value);
                                const currentEstoque = { ...(produtoForm.estoque_por_variante || {}) };
                                currentEstoque[comb] = qty;
                                setProdutoForm({ ...produtoForm, estoque_por_variante: currentEstoque });
                              }}
                              className={`w-20 px-2 py-1 border rounded-lg text-xs font-bold text-center focus:ring-1 focus:ring-indigo-500 focus:outline-none ${
                                selectedId 
                                  ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' 
                                  : 'bg-white border-slate-200 text-slate-800'
                              }`}
                            />
                          </div>
                        ))}
                      </div>
                      {selectedId && (
                        <p className="text-[10px] text-slate-400 italic mt-1">
                          * Para alterar o estoque deste produto, utilize a seção <strong>Dar Entrada no Estoque</strong> logo abaixo.
                        </p>
                      )}
                    </div>

                  </div>

                  {/* Kit toggle */}
                  <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <input
                      type="checkbox"
                      id="is_kit"
                      checked={produtoForm.is_kit || false}
                      onChange={e => {
                        setProdutoForm({ ...produtoForm, is_kit: e.target.checked });
                        if (!e.target.checked) setKitItens([]);
                      }}
                      className="w-4 h-4 rounded text-indigo-600 border-slate-300"
                    />
                    <label htmlFor="is_kit" className="text-xs font-bold text-indigo-700 cursor-pointer">
                      Este produto é um <strong>Kit</strong> — composto por outros produtos previamente cadastrados
                    </label>
                  </div>

                  {/* Kit composition */}
                  {produtoForm.is_kit && (
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                      <h4 className="font-bold text-slate-800 text-sm">Composição do Kit</h4>
                      <div className="flex gap-2 items-end flex-wrap">
                        <div className="flex-1 min-w-40">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Produto do Catálogo</label>
                          <select
                            value={selectedKitComponentProduct}
                            onChange={e => {
                              setSelectedKitComponentProduct(e.target.value);
                              setSelectedKitComponentVariant('default');
                            }}
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          >
                            <option value="">Selecione o produto...</option>
                            {produtos.filter(p => !p.is_kit && p.id !== selectedId).map(p => (
                              <option key={p.id} value={p.id}>{p.nome}</option>
                            ))}
                          </select>
                        </div>
                        {selectedKitComponentProduct && (() => {
                          const prod = produtos.find(p => p.id === selectedKitComponentProduct);
                          const variantes = prod?.variantes || [];
                          if (variantes.length > 0) {
                            return (
                              <div className="min-w-36">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Variante</label>
                                <select
                                  value={selectedKitComponentVariant}
                                  onChange={e => setSelectedKitComponentVariant(e.target.value)}
                                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                >
                                  <option value="default">Sem variante específica</option>
                                  {variantes.flatMap((v: any) =>
                                    (v.opcoes || []).map((op: string) => (
                                      <option key={`${v.tipo}-${op}`} value={`${v.tipo}:${op}`}>{v.tipo}: {op}</option>
                                    ))
                                  )}
                                </select>
                              </div>
                            );
                          }
                          return null;
                        })()}
                        <div className="w-24">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Qtd.</label>
                          <input
                            type="number"
                            min={1}
                            value={selectedKitComponentQty}
                            onChange={e => setSelectedKitComponentQty(Number(e.target.value))}
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!selectedKitComponentProduct) return;
                            const prod = produtos.find(p => p.id === selectedKitComponentProduct);
                            const alreadyIdx = kitItens.findIndex(k => k.produto_id === selectedKitComponentProduct && k.variante === selectedKitComponentVariant);
                            if (alreadyIdx >= 0) {
                              const updated = [...kitItens];
                              updated[alreadyIdx].quantidade += selectedKitComponentQty;
                              setKitItens(updated);
                            } else {
                              setKitItens([...kitItens, {
                                produto_id: selectedKitComponentProduct,
                                nome_produto: prod?.nome || '',
                                variante: selectedKitComponentVariant,
                                quantidade: selectedKitComponentQty
                              }]);
                            }
                            setSelectedKitComponentProduct('');
                            setSelectedKitComponentVariant('default');
                            setSelectedKitComponentQty(1);
                          }}
                          className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 self-end whitespace-nowrap"
                        >
                          + Adicionar ao Kit
                        </button>
                      </div>

                      {kitItens.length > 0 ? (
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                          <div className="flex items-center px-4 py-2 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <span className="flex-1">Produto</span>
                            <span className="w-28 text-center">Variante</span>
                            <span className="w-16 text-center">Qtd.</span>
                            <span className="w-10"></span>
                          </div>
                          {kitItens.map((item, idx) => (
                            <div key={idx} className="flex items-center px-4 py-3 text-xs text-slate-700">
                              <span className="flex-1 font-bold">{item.nome_produto}</span>
                              <span className="w-28 text-center text-slate-400 text-[11px]">
                                {item.variante && item.variante !== 'default' ? item.variante.replace(':', ': ') : '—'}
                              </span>
                              <span className="w-16 text-center font-bold text-indigo-600">× {item.quantidade}</span>
                              <div className="w-10 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => setKitItens(kitItens.filter((_, i) => i !== idx))}
                                  className="text-red-400 hover:text-red-600"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">Nenhum item adicionado ao kit ainda. Use o seletor acima para compor o kit.</p>
                      )}
                    </div>
                  )}

                </form>

                {selectedId && (
                  <div className="mt-8 pt-8 border-t border-slate-100 space-y-6">
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                      <h4 className="font-bold text-slate-800 text-sm">Dar Entrada no Estoque</h4>
                      <form onSubmit={handleStockAddition} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Combinação / Variante</label>
                          <select
                            value={entradaVarianteKey}
                            onChange={e => setEntradaVarianteKey(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-750 font-medium"
                          >
                            {getCombinations(produtoForm.variantes || []).map(comb => (
                              <option key={comb} value={comb}>
                                {comb === 'default' ? 'Estoque Geral' : comb}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data da Entrada</label>
                          <input
                            type="date"
                            required
                            value={entradaData}
                            onChange={e => setEntradaData(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-750 font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantidade</label>
                          <input
                            type="number"
                            required
                            value={entradaQuantidade || ''}
                            onChange={e => setEntradaQuantidade(Number(e.target.value))}
                            placeholder="Ex: 10 ou -5"
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-750 font-medium"
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs"
                        >
                          {entradaQuantidade < 0 ? 'Registrar Ajuste' : 'Registrar Entrada'}
                        </button>
                      </form>
                    </div>

                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                      <h4 className="font-bold text-slate-800 text-sm">Histórico de Entrada de Estoque</h4>
                      {estoqueHistorico.length > 0 ? (
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                          <div className="flex items-center px-4 py-2 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <span className="w-32">Data</span>
                            <span className="flex-1">Variante</span>
                            <span className="w-24 text-center">Quantidade</span>
                            <span className="w-24 text-right">Motivo</span>
                          </div>
                          {estoqueHistorico.map((item) => (
                            <div key={item.id} className="flex items-center px-4 py-3 text-xs text-slate-750">
                              <span className="w-32 font-medium text-slate-500">
                                {formatDateTime(item.created_at)}
                              </span>
                              <span className="flex-1 font-semibold text-slate-800">
                                {item.variante_key === 'default' ? 'Estoque Geral' : item.variante_key}
                              </span>
                              <span className={`w-24 text-center font-bold ${item.tipo === 'saida' || item.quantidade < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                                {item.tipo === 'saida' && item.quantidade > 0 ? `-${item.quantidade}` : (item.quantidade >= 0 ? `+${item.quantidade}` : item.quantidade)}
                              </span>
                              <span className="w-24 text-right capitalize text-slate-500">
                                {item.motivo === 'adicao' ? 'entrada' : item.motivo === 'ajuste' ? 'ajuste' : item.motivo === 'remocao' ? 'saída' : item.motivo}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">Nenhuma entrada de estoque registrada para este produto.</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            

            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-slate-100 shrink-0 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="product-edit-form"
                disabled={loadingAction}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm flex items-center gap-2"
              >
                {loadingAction ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check className="w-5 h-5" />
                )}
                {selectedId ? 'Salvar Alterações' : 'Criar Produto'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      
      {/* MAIN CONTENT */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Produtos</h2>
        <button
          onClick={() => {
            setSelectedId(null);
            setProdutoForm({
              nome: '', slug: '', descricao: '', categoria_id: '',
              imagens: [], preco: 0, estoque_por_variante: {}, is_destaque: false,
              is_kit: false, kit_itens: [], variantes: []
            });
            setImagensInputText('');
            setVariantTypeInput('');
            setVariantOptionsInput('');
            setKitItens([]);
            setIsEditing(true);
          }}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Novo Produto
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="p-4 text-xs font-bold text-slate-500 uppercase">Produto</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase">Preço</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase">Status</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase text-center w-24">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {produtos.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500 text-sm">
                  Nenhum produto cadastrado.
                </td>
              </tr>
            ) : (
              produtos.map((produto) => (
                <tr key={produto.id} className="hover:bg-slate-50">
                  <td className="p-4">
                    <p className="text-sm font-bold text-slate-800">{produto.nome}</p>
                    {produto.is_kit && <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">KIT</span>}
                  </td>
                  <td className="p-4">
                    <span className="text-sm font-medium text-slate-600">
                      R$ {Number(produto.preco).toFixed(2).replace('.', ',')}
                    </span>
                    {produto.preco_promocional && (
                      <span className="ml-2 text-xs text-rose-500 line-through">
                        R$ {Number(produto.preco_promocional).toFixed(2).replace('.', ',')}
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                     {produto.is_destaque && <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">DESTAQUE</span>}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleEditProduto(produto)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduto(produto.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
