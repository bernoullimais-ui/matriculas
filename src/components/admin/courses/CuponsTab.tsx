import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { 
  Plus, Edit2, Trash2, Tag, Ticket, BookOpen, X, Calendar, Settings2, Save
} from 'lucide-react';
import { useAdminStore } from '../../../stores/adminStore';
import { formatCurrency } from '../../../utils/formatters';

export function CuponsTab() {
  const { cupons, cuponsDeMatriculas, eventos, produtos, options, loadData } = useAdminStore();
  
  const [cuponsSubTab, setCuponsSubTab] = useState<'cursos'|'produtos'|'eventos'>('cursos');
  const [editingCupom, setEditingCupom] = useState<any | null>(null);

  const getTodayDateString = () => new Date().toISOString().split('T')[0];

  // For Eventos and Produtos
  const [cupomForm, setCupomForm] = useState<any>({
    codigo: '', tipo_desconto: 'porcentagem', valor: 0,
    data_inicio: getTodayDateString(), data_expiracao: '', 
    limite_total_uso: '', limite_por_usuario: '', ativo: true,
    escopo: 'loja_todos', produto_id: '', evento_id: ''
  });

  // For Cursos
  const [cupomCursoForm, setCupomCursoForm] = useState<any>({
    codigo: '', tipo_desconto: 'porcentagem', valor: 0, 
    data_inicio: getTodayDateString(), data_expiracao: '', 
    limite_total_uso: '', limite_por_usuario: '', ativo: true,
    unidade: '', turma_id: '', aplicar_em: 'todas_parcelas', escopo: 'cursos_todos'
  });

  const [selectedUnidade, setSelectedUnidade] = useState('');
  const turmasFiltradas = options.turmas?.filter((t: any) => selectedUnidade ? t.unidades_selecionadas?.includes(selectedUnidade) : true) || [];

  const handleCouponSubmit = async (e: React.FormEvent, isCurso = false, isEdit = false) => {
    e.preventDefault();
    const token = sessionStorage.getItem('admin_token');
    const headers = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };

    const form = isEdit ? editingCupom : (isCurso ? cupomCursoForm : cupomForm);

    const payload = {
      ...form,
      valor: Number(form.valor),
      limite_total_uso: form.limite_total_uso !== '' && form.limite_total_uso !== null ? Number(form.limite_total_uso) : null,
      limite_por_usuario: form.limite_por_usuario !== '' && form.limite_por_usuario !== null ? Number(form.limite_por_usuario) : null,
      validade: form.data_expiracao || null
    };

    if (isCurso || form._isCurso) {
      payload.escopo = payload.turma_id ? 'curso_especifico' : 'cursos_todos';
    } else {
      if (cuponsSubTab === 'eventos' || form._isEvento) {
        payload.escopo = payload.evento_id ? 'eventos_especifico' : 'eventos_todos';
      } else if (cuponsSubTab === 'produtos' || form._isProduto) {
        payload.escopo = payload.produto_id ? 'loja_especifico' : 'loja_todos';
      }
    }

    try {
      const url = isEdit ? `/api/admin/cupons/${editingCupom.id}` : '/api/admin/cupons';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, { method, headers, body: JSON.stringify(payload) });
      if (res.ok) {
        toast.success(isEdit ? 'Cupom atualizado!' : 'Cupom criado!');
        if (isEdit) {
          setEditingCupom(null);
        } else {
          if (isCurso) {
            setCupomCursoForm({
              codigo: '', tipo_desconto: 'porcentagem', valor: 0, data_inicio: getTodayDateString(), data_expiracao: '', 
              limite_total_uso: '', limite_por_usuario: '', ativo: true, unidade: '', turma_id: '', aplicar_em: 'todas_parcelas', escopo: 'cursos_todos'
            });
            setSelectedUnidade('');
          } else {
            setCupomForm({
              codigo: '', tipo_desconto: 'porcentagem', valor: 0, data_inicio: getTodayDateString(), data_expiracao: '', 
              limite_total_uso: '', limite_por_usuario: '', ativo: true,
              escopo: cuponsSubTab === 'eventos' ? 'eventos_todos' : 'loja_todos', produto_id: '', evento_id: ''
            });
          }
        }
        loadData();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Erro ao salvar cupom.');
      }
    } catch {
      toast.error('Erro de conexão.');
    }
  };

  const handleDeleteCupom = async (id: string) => {
    if (!window.confirm('Excluir cupom permanentemente?')) return;
    try {
      const token = sessionStorage.getItem('admin_token');
      const res = await fetch(`/api/admin/cupons/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erro ao excluir');
      toast.success('Cupom excluído!');
      loadData();
    } catch (err) {
      toast.error('Erro ao excluir cupom');
    }
  };

  const openEditModal = (c: any, isCurso: boolean) => {
    setEditingCupom({
      ...c,
      tipo_desconto: c.tipo_desconto || (c.tipo === 'percentual' ? 'porcentagem' : 'fixo'),
      data_expiracao: c.data_expiracao || (c.validade ? new Date(c.validade).toISOString().split('T')[0] : ''),
      limite_total_uso: c.limite_total_uso || c.limite_uso || '',
      limite_por_usuario: c.limite_por_usuario || '',
      _isCurso: isCurso,
      _isEvento: c.escopo?.includes('eventos') || !!c.evento_id,
      _isProduto: c.escopo?.includes('loja') || !!c.produto_id
    });
  };

  // Combine both arrays to ensure no coupon is left behind, and remove duplicates
  const allCupons = [...cupons, ...cuponsDeMatriculas].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

  const listCursos = allCupons.filter(c => 
    c.escopo === 'cursos_todos' || 
    c.escopo === 'curso_especifico' || 
    (!c.escopo && !c.evento_id && !c.produto_id)
  );
  
  const listEventos = allCupons.filter(c => 
    c.escopo === 'eventos_todos' || 
    c.escopo === 'eventos_especifico' || 
    (!c.escopo && c.evento_id)
  );
  
  const listProdutos = allCupons.filter(c => 
    c.escopo === 'loja_todos' || 
    c.escopo === 'loja_especifico' || 
    (!c.escopo && c.produto_id)
  );

  const renderTable = (list: any[], isCurso = false) => (
    <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-slate-100 mt-6">
      <table className="w-full text-left text-sm text-slate-600">
        <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold border-b border-slate-100">
          <tr>
            <th className="px-4 py-3">Código</th>
            <th className="px-4 py-3">Desconto</th>
            <th className="px-4 py-3">Validade</th>
            <th className="px-4 py-3">Limites</th>
            <th className="px-4 py-3">Regras</th>
            <th className="px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {list.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Nenhum cupom encontrado.</td>
            </tr>
          ) : list.map(c => (
            <tr key={c.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3 font-bold text-slate-800 uppercase">{c.codigo}</td>
              <td className="px-4 py-3">
                <span className="text-emerald-600 font-bold bg-emerald-50 rounded px-2 py-0.5 inline-block">
                  {c.tipo_desconto === 'porcentagem' || c.tipo === 'percentual' ? `${c.valor}%` : formatCurrency(c.valor)}
                </span>
              </td>
              <td className="px-4 py-3">
                {c.data_inicio && <div className="text-xs text-slate-400">Início: {new Date(c.data_inicio).toLocaleDateString()}</div>}
                <div className="font-semibold text-slate-700">Fim: {c.data_expiracao || c.validade ? new Date(c.data_expiracao || c.validade).toLocaleDateString() : 'Sem expiração'}</div>
              </td>
              <td className="px-4 py-3 text-xs">
                <div>Global: <span className="font-semibold">{c.limite_total_uso || c.limite_uso || '∞'}</span></div>
                <div>Por cliente: <span className="font-semibold">{c.limite_por_usuario || '∞'}</span></div>
                <div className="mt-1 pt-1 border-t border-slate-100 text-indigo-600">Usados: <span className="font-bold">{c.cupom_usos?.length || 0} vez(es)</span></div>
              </td>
              <td className="px-4 py-3 text-xs">
                {isCurso && (
                  <div className="mb-1 font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded w-max">
                    {c.aplicar_em === 'primeira_parcela' ? 'Apenas 1º Ciclo' : 'Todos os Ciclos'}
                  </div>
                )}
                <div className="text-slate-500 font-medium">
                  {c.escopo?.includes('todos') ? 'Aplicável a Todos' : (isCurso ? 'Curso Específico' : (c.escopo?.includes('eventos') ? 'Evento Específico' : 'Produto Específico'))}
                </div>
              </td>
              <td className="px-4 py-3 text-right space-x-2">
                {sessionStorage.getItem('admin_role') === 'master' && (
                  <>
                    <button onClick={() => openEditModal(c, isCurso)} className="text-slate-400 hover:text-indigo-600 p-1.5 bg-white rounded shadow-sm border border-slate-200 transition-colors">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDeleteCupom(c.id)} className="text-slate-400 hover:text-rose-600 p-1.5 bg-white rounded shadow-sm border border-slate-200 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderFormFields = (form: any, setForm: any, isCurso = false) => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Código do Cupom</label>
          <input type="text" required value={form.codigo} onChange={(e) => setForm({...form, codigo: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none uppercase font-black text-indigo-900 bg-indigo-50/30" placeholder="EX: MATRICULA2025"/>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Desconto</label>
          <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
            <select value={form.tipo_desconto} onChange={(e) => setForm({...form, tipo_desconto: e.target.value})} className="bg-slate-50 border-r border-slate-200 px-3 py-3 outline-none text-sm font-semibold text-slate-600">
              <option value="porcentagem">%</option>
              <option value="fixo">R$</option>
            </select>
            <input type="number" required min="0" step="0.01" value={form.valor} onChange={(e) => setForm({...form, valor: parseFloat(e.target.value)})} className="w-full px-3 py-3 outline-none font-bold text-slate-800"/>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isCurso && (
          <>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Unidade (Filtro)</label>
              <select value={selectedUnidade} onChange={(e) => {
                setSelectedUnidade(e.target.value);
                setForm({...form, turma_id: ''}); // reset turma when unit changes
              }} className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="">Todas as Unidades</option>
                {options.unidades?.map((u: any) => <option key={u.id} value={u.nome}>{u.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Curso Específico</label>
              <select value={form.turma_id || ''} onChange={(e) => setForm({...form, turma_id: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="">Aplicar a todos os cursos</option>
                {turmasFiltradas.map((t: any) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
            <div className="md:col-span-2 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-center gap-3">
              <Settings2 size={24} className="text-indigo-400" />
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Aplicabilidade do Desconto</label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name={`aplicar_em_${isCurso ? 'curso' : 'other'}`} value="primeira_parcela" checked={form.aplicar_em === 'primeira_parcela'} onChange={() => setForm({...form, aplicar_em: 'primeira_parcela'})} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-sm font-semibold text-slate-700">Apenas no 1º Ciclo (Matrícula)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name={`aplicar_em_${isCurso ? 'curso' : 'other'}`} value="todas_parcelas" checked={form.aplicar_em === 'todas_parcelas'} onChange={() => setForm({...form, aplicar_em: 'todas_parcelas'})} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-sm font-semibold text-slate-700">Em todos os ciclos (Mensalidades)</span>
                  </label>
                </div>
              </div>
            </div>
          </>
        )}

        {!isCurso && (cuponsSubTab === 'eventos' || form._isEvento) && (
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Evento Específico</label>
            <select value={form.evento_id || ''} onChange={(e) => setForm({...form, evento_id: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none">
              <option value="">Aplicar a todos os eventos</option>
              {eventos.map(evt => <option key={evt.id} value={evt.id}>{evt.titulo}</option>)}
            </select>
          </div>
        )}

        {!isCurso && (cuponsSubTab === 'produtos' || form._isProduto) && (
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Produto Específico</label>
            <select value={form.produto_id || ''} onChange={(e) => setForm({...form, produto_id: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none">
              <option value="">Aplicar a todos os produtos</option>
              {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Validade</label>
          <div className="flex items-center gap-2">
            <input type="date" required value={form.data_inicio} onChange={(e) => setForm({...form, data_inicio: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"/>
            <span className="text-slate-400 font-bold">Até</span>
            <input type="date" value={form.data_expiracao} onChange={(e) => setForm({...form, data_expiracao: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"/>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Deixe a data final vazia para não expirar.</p>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Limite Global</label>
          <input type="number" min="1" value={form.limite_total_uso || ''} onChange={(e) => setForm({...form, limite_total_uso: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" placeholder="Ex: 100 usos"/>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Por Cliente</label>
          <input type="number" min="1" value={form.limite_por_usuario || ''} onChange={(e) => setForm({...form, limite_por_usuario: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" placeholder="Ex: 1 uso"/>
        </div>
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Cupons de Desconto</h2>
          <p className="text-slate-500">Crie e gerencie códigos promocionais para a loja, eventos ou cursos.</p>
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-200 overflow-x-auto pb-px">
        <button 
          onClick={() => setCuponsSubTab('cursos')}
          className={`px-4 py-3 font-bold border-b-2 transition-colors whitespace-nowrap ${cuponsSubTab === 'cursos' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <span className="flex items-center gap-2"><BookOpen size={18}/> Cursos Regulares</span>
        </button>
        <button 
          onClick={() => setCuponsSubTab('eventos')}
          className={`px-4 py-3 font-bold border-b-2 transition-colors whitespace-nowrap ${cuponsSubTab === 'eventos' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <span className="flex items-center gap-2"><Ticket size={18}/> Inscrições (Eventos)</span>
        </button>
        <button 
          onClick={() => setCuponsSubTab('produtos')}
          className={`px-4 py-3 font-bold border-b-2 transition-colors whitespace-nowrap ${cuponsSubTab === 'produtos' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <span className="flex items-center gap-2"><Tag size={18}/> Produtos da Loja</span>
        </button>
      </div>

      {sessionStorage.getItem('admin_role') === 'master' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Plus size={20} className="text-indigo-600"/> 
            Novo Cupom de {cuponsSubTab === 'cursos' ? 'Curso' : cuponsSubTab === 'eventos' ? 'Evento' : 'Produto'}
          </h3>
          <form onSubmit={(e) => handleCouponSubmit(e, cuponsSubTab === 'cursos')} className="space-y-5">
            {renderFormFields(cuponsSubTab === 'cursos' ? cupomCursoForm : cupomForm, cuponsSubTab === 'cursos' ? setCupomCursoForm : setCupomForm, cuponsSubTab === 'cursos')}
            
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button type="submit" className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors flex items-center gap-2 shadow-sm shadow-indigo-200">
                <Plus size={18}/> Adicionar Cupom
              </button>
            </div>
          </form>
        </div>
      )}
      
      {cuponsSubTab === 'cursos' && renderTable(listCursos, true)}
      {cuponsSubTab === 'eventos' && renderTable(listEventos, false)}
      {cuponsSubTab === 'produtos' && renderTable(listProdutos, false)}

      {/* MODAL DE EDIÇÃO */}
      {editingCupom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 md:p-8 relative shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <button onClick={() => setEditingCupom(null)} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
              <X size={20} />
            </button>
            <h3 className="text-2xl font-black text-slate-800 mb-2 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Edit2 size={20} />
              </span>
              Editar Cupom
            </h3>
            <p className="text-slate-500 mb-8 ml-13">Modifique as regras, validade e limites do cupom.</p>
            
            <form onSubmit={(e) => handleCouponSubmit(e, editingCupom._isCurso, true)} className="space-y-6">
              {renderFormFields(editingCupom, setEditingCupom, editingCupom._isCurso)}
              
              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button type="button" onClick={() => setEditingCupom(null)} className="px-6 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-xl transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors flex items-center gap-2 shadow-sm shadow-indigo-200">
                  <Save size={18}/> Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
