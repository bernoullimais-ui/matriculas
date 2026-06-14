import os

content = """import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';
import { 
  Plus, Edit2, Trash2, Save, Tag, Ticket, X
} from 'lucide-react';
import { useAdminStore } from '../../../stores/adminStore';
import { formatCurrency } from '../../../utils/formatters';

export function CuponsTab() {
  const { cupons, setCupons, cuponsDeMatriculas, setCuponsDeMatriculas, eventos, produtos, loadData } = useAdminStore();
  
  const [cuponsSubTab, setCuponsSubTab] = useState<'cursos'|'produtos'>('cursos');
  const [editingCupomId, setEditingCupomId] = useState<string | null>(null);
  const [cupomEditForm, setCupomEditForm] = useState<Record<string, any>>({});
  const [loadingAction, setLoadingAction] = useState(false);

  const getTodayDateString = () => new Date().toISOString().split('T')[0];

  const [cupomForm, setCupomForm] = useState<any>({
    codigo: '', tipo_desconto: 'porcentagem', valor: 0,
    data_validade: '', uso_maximo: null, ativo: true,
    aplicabilidade: 'todos', produto_id: '',
    limite_total_uso: '', limite_por_usuario: '', validade: '', escopo: 'loja_todos'
  });

  const [cupomCursoForm, setCupomCursoForm] = useState<any>({
    codigo: '', tipo: 'porcentagem', valor: 0, data_inicio: getTodayDateString(),
    data_validade: '', evento_id: '', curso_id: ''
  });

  const handleCouponSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = sessionStorage.getItem('admin_token');
    const headers = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };

    const payload = {
      ...cupomForm,
      limite_total_uso: cupomForm.limite_total_uso !== '' ? cupomForm.limite_total_uso : null,
      limite_por_usuario: cupomForm.limite_por_usuario !== '' ? cupomForm.limite_por_usuario : null,
      validade: cupomForm.validade || null
    };

    try {
      const res = await fetch('/api/admin/cupons', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        toast.success('Cupom criado com sucesso!');
        setCupomForm({
          codigo: '', tipo_desconto: 'porcentagem', valor: 0, escopo: 'loja_todos',
          produto_id: '', evento_id: '', limite_total_uso: '', limite_por_usuario: '', validade: ''
        });
        loadData();
      } else if (res.status === 401) {
        toast.error('Sua sessão expirou por segurança. Faça login novamente.');
        setTimeout(() => {
          sessionStorage.removeItem('admin_token');
          sessionStorage.removeItem('admin_role');
          window.location.href = '/admin-login';
        }, 2000);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Erro ao criar cupom.');
      }
    } catch {
      toast.error('Erro ao conectar com servidor.');
    }
  };

  const handleCouponEditSave = async (id: string) => {
    const token = sessionStorage.getItem('admin_token');
    const headers = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
    const payload = {
      ...cupomEditForm,
      limite_total_uso: (cupomEditForm.limite_total_uso !== '' && cupomEditForm.limite_total_uso !== null && cupomEditForm.limite_total_uso !== undefined) ? cupomEditForm.limite_total_uso : '__clear__',
      limite_por_usuario: (cupomEditForm.limite_por_usuario !== '' && cupomEditForm.limite_por_usuario !== null && cupomEditForm.limite_por_usuario !== undefined) ? cupomEditForm.limite_por_usuario : '__clear__',
      validade: cupomEditForm.validade || null
    };
    try {
      const res = await fetch(`/api/admin/cupons/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        toast.success('Cupom atualizado com sucesso!');
        setEditingCupomId(null);
        setCupomEditForm({});
        loadData();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Erro ao atualizar cupom.');
      }
    } catch {
      toast.error('Erro ao conectar com servidor.');
    }
  };


  const handleDeleteCupom = async (id: string, table: string = 'loja_cupons') => {
    if (!window.confirm('Excluir cupom?')) return;
    try {
      const res = await fetch(`/api/admin/loja/cupons/${id}?table=${table}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('admin_token')}` }
      });
      if (!res.ok) throw new Error('Erro ao excluir');
      toast.success('Cupom excluído!');
      if (table === 'loja_cupons') {
        setCupons(cupons.filter(c => c.id !== id));
      } else {
        setCuponsDeMatriculas(cuponsDeMatriculas.filter(c => c.id !== id));
      }
    } catch (err) {
      toast.error('Erro ao excluir cupom');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Cupons de Desconto</h2>
          <p className="text-slate-500">Crie e gerencie códigos promocionais para a loja ou inscrições.</p>
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-200">
        <button 
          onClick={() => setCuponsSubTab('cursos')}
          className={`px-4 py-3 font-bold border-b-2 transition-colors ${cuponsSubTab === 'cursos' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <span className="flex items-center gap-2"><Ticket size={18}/> Inscrições (Eventos)</span>
        </button>
        <button 
          onClick={() => setCuponsSubTab('produtos')}
          className={`px-4 py-3 font-bold border-b-2 transition-colors ${cuponsSubTab === 'produtos' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <span className="flex items-center gap-2"><Tag size={18}/> Produtos da Loja</span>
        </button>
      </div>

      {cuponsSubTab === 'cursos' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Plus size={20} className="text-indigo-600"/> 
              Novo Cupom de Inscrição
            </h3>
            <form onSubmit={handleCouponSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Código do Cupom</label>
                  <input type="text" required value={cupomForm.codigo} onChange={(e) => setCupomForm({...cupomForm, codigo: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none uppercase font-bold" placeholder="EX: VERAO2025"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Evento Vinculado</label>
                  <select value={cupomForm.evento_id || ''} onChange={(e) => setCupomForm({...cupomForm, evento_id: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="">Selecione um evento...</option>
                    {eventos.map(evt => <option key={evt.id} value={evt.id}>{evt.titulo}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tipo de Desconto</label>
                  <select value={cupomForm.tipo_desconto} onChange={(e) => setCupomForm({...cupomForm, tipo_desconto: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="porcentagem">Porcentagem (%)</option>
                    <option value="fixo">Valor Fixo (R$)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Valor</label>
                  <input type="number" required min="0" step="0.01" value={cupomForm.valor} onChange={(e) => setCupomForm({...cupomForm, valor: parseFloat(e.target.value)})} className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"/>
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors flex items-center gap-2">
                  <Plus size={18}/> Adicionar Cupom
                </button>
              </div>
            </form>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cuponsDeMatriculas.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                Nenhum cupom de inscrição encontrado.
              </div>
            ) : cuponsDeMatriculas.map(cupom => (
              <div key={cupom.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative group overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
                <div className="flex justify-between items-start mb-3 pl-2">
                  <h4 className="text-xl font-black text-slate-800 tracking-wider uppercase">{cupom.codigo}</h4>
                  <button onClick={() => handleDeleteCupom(cupom.id, 'cupons_de_matriculas')} className="text-rose-400 hover:text-rose-600 p-1 bg-rose-50 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={16}/>
                  </button>
                </div>
                <div className="space-y-2 pl-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-bold text-slate-500">Desconto:</span>
                    <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                      {cupom.tipo === 'porcentagem' ? `${cupom.valor}%` : formatCurrency(cupom.valor)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {cuponsSubTab === 'produtos' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Plus size={20} className="text-indigo-600"/> 
              Novo Cupom de Produto
            </h3>
            <form onSubmit={handleCouponSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Código do Cupom</label>
                  <input type="text" required value={cupomForm.codigo} onChange={(e) => setCupomForm({...cupomForm, codigo: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none uppercase font-bold" placeholder="EX: OFERTA10"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Produto Específico</label>
                  <select value={cupomForm.produto_id || ''} onChange={(e) => setCupomForm({...cupomForm, produto_id: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="">Aplicar a todos os produtos</option>
                    {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tipo de Desconto</label>
                  <select value={cupomForm.tipo_desconto} onChange={(e) => setCupomForm({...cupomForm, tipo_desconto: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="porcentagem">Porcentagem (%)</option>
                    <option value="fixo">Valor Fixo (R$)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Valor</label>
                  <input type="number" required min="0" step="0.01" value={cupomForm.valor} onChange={(e) => setCupomForm({...cupomForm, valor: parseFloat(e.target.value)})} className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"/>
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors flex items-center gap-2">
                  <Plus size={18}/> Adicionar Cupom
                </button>
              </div>
            </form>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cupons.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                Nenhum cupom da loja encontrado.
              </div>
            ) : cupons.map(cupom => (
              <div key={cupom.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative group overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
                <div className="flex justify-between items-start mb-3 pl-2">
                  <h4 className="text-xl font-black text-slate-800 tracking-wider uppercase">{cupom.codigo}</h4>
                  <button onClick={() => handleDeleteCupom(cupom.id, 'loja_cupons')} className="text-rose-400 hover:text-rose-600 p-1 bg-rose-50 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={16}/>
                  </button>
                </div>
                <div className="space-y-2 pl-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-bold text-slate-500">Desconto:</span>
                    <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                      {cupom.tipo_desconto === 'porcentagem' ? `${cupom.valor}%` : formatCurrency(cupom.valor)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
"""

with open('src/components/admin/courses/CuponsTab.tsx', 'w') as f:
    f.write(content)
print("Rewritten successfully!")
