import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';
import { motion } from 'motion/react';
import { 
  Plus, Edit2, Trash2, Tag, X, Check, Truck, Box 
} from 'lucide-react';
import { useAdminStore } from '../../../stores/adminStore';

interface Categoria {
  id: string;
  nome: string;
  slug: string;
  descricao: string;
  ordem: number;
}

export function CategoriasTab() {
  const { categorias, setCategorias, loading, setLoading, loadData } = useAdminStore();
  const canEdit = (window as any).checkAdminPermission ? (window as any).checkAdminPermission('loja_categorias', 'editar') : true;
  const canDelete = (window as any).checkAdminPermission ? (window as any).checkAdminPermission('loja_categorias', 'excluir') : true;
  
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  const [categoriaForm, setCategoriaForm] = useState<Partial<Categoria>>({
    nome: '', slug: '', descricao: '', ordem: 0
  });

  const [categoriasSubTab, setCategoriasSubTab] = useState<'lista' | 'frete'>('lista');
  const [entregaCasaHabilitada, setEntregaCasaHabilitada] = useState(false);
  const [entregaCasaPreco, setEntregaCasaPreco] = useState(0);
  const [isSavingFrete, setIsSavingFrete] = useState(false);

  const handleSaveFrete = async () => {
    setIsSavingFrete(true);
    try {
      await Promise.all([
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'loja_entrega_casa_habilitada', value: entregaCasaHabilitada ? 'true' : 'false' })
        }),
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'loja_entrega_casa_preco', value: String(entregaCasaPreco) })
        })
      ]);
      toast.success('Configurações de frete salvas com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar configurações de frete.');
    } finally {
      setIsSavingFrete(false);
    }
  };

  const handleCategoriaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = sessionStorage.getItem('admin_token');
    const headers = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };

    try {
      const url = selectedId ? `/api/admin/loja/categorias/${selectedId}` : '/api/admin/loja/categorias';
      const method = selectedId ? 'PUT' : 'POST';

      const res = await fetch(url, { method, headers, body: JSON.stringify(categoriaForm) });
      if (res.ok) {
        toast.success('Categoria salva!');
        setIsEditing(false);
        setSelectedId(null);
        loadData();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao salvar categoria.');
      }
    } catch {
      toast.error('Erro de rede.');
    }
  };





  const handleEditCategoria = (categoria: Categoria) => {
    setCategoriaForm(categoria);
    setSelectedId(categoria.id);
    setIsEditing(true);
  };

  const handleDeleteCategoria = async (id: string) => {
    if (!confirm('Deseja excluir esta categoria?')) return;
    const token = sessionStorage.getItem('admin_token');
    const res = await fetch(`/api/admin/loja/categorias/${id}`, {
      method: 'DELETE',
      headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
    });
    if (res.ok) {
      toast.success('Categoria excluída!');
      loadData();
    } else {
      toast.error('Erro ao excluir categoria');
    }
  };

  return (

    <>
      {/* MODAL DE CATEGORIAS */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsEditing(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
              <h3 className="text-xl font-black text-slate-800">
                {selectedId ? 'Editar Categoria' : 'Nova Categoria'}
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(100vh-200px)]">

                <form id="category-edit-form" onSubmit={handleCategoriaSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome da Categoria</label>
                      <input type="text" required value={categoriaForm.nome || ''} onChange={e => setCategoriaForm({ ...categoriaForm, nome: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Slug (URL)</label>
                      <input type="text" required value={categoriaForm.slug || ''} onChange={e => setCategoriaForm({ ...categoriaForm, slug: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição</label>
                    <textarea value={categoriaForm.descricao || ''} onChange={e => setCategoriaForm({ ...categoriaForm, descricao: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm h-20" />
                  </div>
                </form>
              

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
                form="category-edit-form"
                disabled={loadingAction}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm flex items-center gap-2"
              >
                {loadingAction ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check className="w-5 h-5" />
                )}
                {selectedId ? 'Salvar Alterações' : 'Criar Categoria'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      
      {/* MAIN CONTENT */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Categorias</h2>
        {canEdit && (
          <button
            onClick={() => {
              setSelectedId(null);
              setCategoriaForm({ nome: '', slug: '', descricao: '', ordem: 0 });
              setIsEditing(true);
            }}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nova Categoria
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="p-4 text-xs font-bold text-slate-500 uppercase">Categoria</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase">Slug</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase text-center w-24">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {categorias.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-8 text-center text-slate-500 text-sm">
                  Nenhuma categoria cadastrada.
                </td>
              </tr>
            ) : (
              categorias.map((categoria) => (
                <tr key={categoria.id} className="hover:bg-slate-50">
                  <td className="p-4">
                    <p className="text-sm font-bold text-slate-800">{categoria.nome}</p>
                    <p className="text-xs text-slate-500">{categoria.descricao}</p>
                  </td>
                  <td className="p-4">
                    <span className="text-sm font-medium text-slate-600">{categoria.slug}</span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {canEdit && (
                        <button
                          onClick={() => handleEditCategoria(categoria)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteCategoria(categoria.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
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
