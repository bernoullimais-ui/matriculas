import os

with open('src/pages/Admin/UnifiedAdmin.tsx', 'r') as f:
    lines = f.readlines()

def extract_block(start_marker, braces=True):
    start_idx = -1
    for i, line in enumerate(lines):
        if start_marker in line:
            start_idx = i
            break
    if start_idx == -1: return ""
    
    if braces:
        depth = 0
        end_idx = -1
        for i in range(start_idx, len(lines)):
            depth += lines[i].count('{')
            depth -= lines[i].count('}')
            if depth == 0 and lines[i].count('}') > 0:
                end_idx = i
                break
        if end_idx != -1:
            return "".join(lines[start_idx:end_idx+1])
    return ""

def extract_jsx(start_marker):
    start_idx = -1
    for i, line in enumerate(lines):
        if start_marker in line:
            start_idx = i
            break
    if start_idx == -1: return ""
    
    depth = 0
    end_idx = -1
    for i in range(start_idx, len(lines)):
        depth += lines[i].count('(')
        depth -= lines[i].count(')')
        if depth == 0 and lines[i].count(')') > 0:
            end_idx = i
            break
    if end_idx != -1:
        return "".join(lines[start_idx:end_idx+1])
    return ""

getCombinations = extract_block("function getCombinations")
handleProductSubmit = extract_block("const handleProductSubmit =")
handleStockAddition = extract_block("const handleStockAddition =")
handleReorderProdutos = extract_block("const handleReorderProdutos =")
handleDeleteProduto = extract_block("const handleDeleteProduto =")
handleImageUpload = extract_block("const handleImageUpload =")
handleRemoveImage = extract_block("const handleRemoveImage =")
handleEditProduto = extract_block("const handleEditProduto =")
handleDuplicateProduto = extract_block("const handleDuplicateProduto =")
handleDragStart = extract_block("const handleDragStart =")
handleDragOver = extract_block("const handleDragOver =")
handleDrop = extract_block("const handleDrop =")
handleDragEnd = extract_block("const handleDragEnd =")

with open('produto_modal_extracted.txt', 'r') as f:
    modal_jsx = f.read()

content_jsx = extract_jsx("{tab === 'produtos' && (")

out = """import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Search, Edit2, Trash2, Tag, Archive, Package, 
  Upload, X, Check, Image as ImageIcon, Box, Truck 
} from 'lucide-react';
import { useAdminStore } from '../../../stores/adminStore';
import { formatCurrency } from '../../../utils/formatters';

interface Produto {
  id: string;
  nome: string;
  slug: string;
  descricao: string;
  preco: number;
  preco_promocional?: number | null;
  categoria_id: string;
  destaque: boolean;
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

___GET_COMBINATIONS___

export function ProdutosTab() {
  const { produtos, setProdutos, categorias, loading, setLoading } = useAdminStore();
  
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

___METHODS___

  // Filter products for the list
  const filteredProducts = produtos.filter((p: any) => 
    p.nome.toLowerCase().includes(searchProduto.toLowerCase()) || 
    p.slug.toLowerCase().includes(searchProduto.toLowerCase())
  );

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
___MODAL_JSX___
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
___CONTENT_JSX___
    </>
  );
}
"""

methods = "\n".join([
    handleProductSubmit, handleStockAddition, handleReorderProdutos, 
    handleDeleteProduto, handleImageUpload, handleRemoveImage, 
    handleEditProduto, handleDuplicateProduto, handleDragStart, 
    handleDragOver, handleDrop, handleDragEnd
])

# Strip the leading `{tab === 'produtos' && (` from content_jsx and the trailing `)}`
if content_jsx.startswith("{tab === 'produtos' && ("):
    content_jsx_lines = content_jsx.split("\n")
    content_jsx_lines[0] = ""
    # find trailing )}
    for i in range(len(content_jsx_lines)-1, -1, -1):
        if ")}" in content_jsx_lines[i]:
            content_jsx_lines[i] = content_jsx_lines[i].replace(")}", "")
            break
    content_jsx = "\n".join(content_jsx_lines)

# Same for modal_jsx if it has conditionals
if modal_jsx.startswith("              {tab === 'produtos' && ("):
    modal_jsx_lines = modal_jsx.split("\n")
    modal_jsx_lines[0] = ""
    # find trailing )}
    for i in range(len(modal_jsx_lines)-1, -1, -1):
        if ")}" in modal_jsx_lines[i]:
            modal_jsx_lines[i] = modal_jsx_lines[i].replace(")}", "")
            break
    modal_jsx = "\n".join(modal_jsx_lines)

out = out.replace("___GET_COMBINATIONS___", getCombinations)
out = out.replace("___METHODS___", methods)
out = out.replace("___MODAL_JSX___", modal_jsx)
out = out.replace("___CONTENT_JSX___", content_jsx)

with open('src/components/admin/ecommerce/ProdutosTab.tsx', 'w') as f:
    f.write(out)

print("Created src/components/admin/ecommerce/ProdutosTab.tsx!")
