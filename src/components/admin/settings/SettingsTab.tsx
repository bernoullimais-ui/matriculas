import React, { useState, useEffect } from 'react';
import { useAdminStore } from '../../../stores/adminStore';
import { Edit, Plus, X, Upload, Save, Search, Check, Copy, Trash2, GripVertical, Layers, Star, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsTab() {
  const { termsTemplate, setTermsTemplate, pixKey, setPixKey, logoUrl, setLogoUrl, options, setOptions } = useAdminStore();
  const [settingsSubTab, setSettingsSubTab] = useState<'geral' | 'opcoes' | 'website' | 'frete'>('geral');
  const userRole = sessionStorage.getItem('admin_role') as string;
  const [pagarmeSoftDescriptor, setPagarmeSoftDescriptor] = useState('');
  const [pagarmeSoftDescriptorBernoulli, setPagarmeSoftDescriptorBernoulli] = useState('');
  const [isSavingTerms, setIsSavingTerms] = useState(false);
  const [isSavingPagarme, setIsSavingPagarme] = useState(false);
  const [editingOption, setEditingOption] = useState<any | null>(null);
  const [newOption, setNewOption] = useState<any>({ type: 'series', nome: '', unidades_selecionadas: [], series_permitidas: [] });
  const [isUnidadesDropdownOpen, setIsUnidadesDropdownOpen] = useState(false);
  const [activeOptionsListTab, setActiveOptionsListTab] = useState<'series'|'unidades'|'turmas'|'professores'|'parceiros'>('series');
  const [optionsFilterSearch, setOptionsFilterSearch] = useState('');
  const [websiteConfigs, setWebsiteConfigs] = useState<any>({});
  const [isSavingWebsite, setIsSavingWebsite] = useState(false);
  const [entregaCasaHabilitada, setEntregaCasaHabilitada] = useState(false);
  const [entregaCasaPreco, setEntregaCasaPreco] = useState(0);
  const [optionsFilterUnidade, setOptionsFilterUnidade] = useState('');
  const [optionsFilterProfessor, setOptionsFilterProfessor] = useState('');
  const [isSavingFrete, setIsSavingFrete] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings/bulk?keys=pagarme_soft_descriptor,pagarme_soft_descriptor_bernoulli,terms_template,entrega_casa_habilitada,entrega_casa_preco');
        const data = await res.json();
        if (data.pagarme_soft_descriptor !== undefined) setPagarmeSoftDescriptor(data.pagarme_soft_descriptor || 'SportForKids');
        if (data.pagarme_soft_descriptor_bernoulli !== undefined) setPagarmeSoftDescriptorBernoulli(data.pagarme_soft_descriptor_bernoulli || 'BernoulliMais');
        if (data.terms_template !== undefined) setTermsTemplate(data.terms_template);
        if (data.entrega_casa_habilitada !== undefined) setEntregaCasaHabilitada(data.entrega_casa_habilitada === 'true');
        if (data.entrega_casa_preco !== undefined) setEntregaCasaPreco(Number(data.entrega_casa_preco) || 0);

        const token = sessionStorage.getItem('admin_token');
        const wRes = await fetch('/api/admin/website-configs', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (wRes.ok) {
          const wData = await wRes.json();
          setWebsiteConfigs(wData || {});
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchSettings();
  }, []);

  const saveSoftDescriptors = async () => {
    setIsSavingPagarme(true);
    try {
      await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'pagarme_soft_descriptor', value: pagarmeSoftDescriptor }) });
      await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'pagarme_soft_descriptor_bernoulli', value: pagarmeSoftDescriptorBernoulli }) });
      toast.success('Soft Descriptors salvos!');
    } catch (e) { toast.error('Erro ao salvar'); }
    setIsSavingPagarme(false);
  };
  const saveTermsOfUse = async () => {
    setIsSavingTerms(true);
    try {
      await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'terms_template', value: termsTemplate }) });
      toast.success('Termos salvos!');
    } catch (e) { toast.error('Erro ao salvar'); }
    setIsSavingTerms(false);
  };
  const handleAddOption = async (e: any) => {
    e.preventDefault();
    const token = sessionStorage.getItem('admin_token');
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

    try {
      if (!newOption.nome && newOption.type !== 'professores') {
        toast.error('O campo Nome é obrigatório.'); return;
      }

      let url = '';
      let body: any = {};

      if (newOption.type === 'professores') {
        url = editingOption ? `/api/professores/${editingOption.id}` : '/api/professores';
        body = { nome: newOption.nome, foto_url: newOption.foto_url || '', bio: newOption.bio || '' };
      } else if (newOption.type === 'parceiros') {
        url = editingOption ? `/api/parceiros/${editingOption.id}` : '/api/parceiros';
        body = { nome: newOption.nome, logo_url: newOption.logo_url || '', descricao: newOption.descricao || '', slug: newOption.slug || '' };
      } else {
        if (editingOption) {
          url = `/api/options/${newOption.type}/${encodeURIComponent(editingOption.nome || editingOption.id)}`;
        } else {
          url = `/api/options/${newOption.type}`;
        }
        body = { ...newOption };
        delete body.type;
      }

      const method = editingOption ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao salvar');
      }

      toast.success(editingOption ? 'Atualizado com sucesso!' : 'Adicionado com sucesso!');
      setEditingOption(null);
      setNewOption({ type: 'series', nome: '', unidades_selecionadas: [], series_permitidas: [] });

      // Reload options from server
      const optRes = await fetch('/api/options', { headers });
      if (optRes.ok) setOptions(await optRes.json());
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    }
  };

  const handleDeleteOption = async (type: string, id: string, extraId?: string) => {
    const token = sessionStorage.getItem('admin_token');
    const headers = { 'Authorization': `Bearer ${token}` };
    const confirmed = window.confirm('Tem certeza que deseja excluir este item?');
    if (!confirmed) return;

    try {
      let url = '';
      if (type === 'professores') {
        url = `/api/professores/${id}`;
      } else if (type === 'parceiros') {
        url = `/api/parceiros/${id}`;
      } else {
        // id here is the item nome
        url = `/api/options/${type}/${encodeURIComponent(id)}`;
      }

      const res = await fetch(url, { method: 'DELETE', headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao excluir');
      }

      toast.success('Excluído com sucesso!');

      // Reload options from server
      const optRes = await fetch('/api/options', { headers: { ...headers, 'Content-Type': 'application/json' } });
      if (optRes.ok) setOptions(await optRes.json());
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir');
    }
  };
  const handleWebsiteConfigChange = (field: string, value: any) => { setWebsiteConfigs({ ...websiteConfigs, [field]: value }); };
  const saveWebsiteConfigs = async () => {
    setIsSavingWebsite(true);
    try {
      const token = sessionStorage.getItem('admin_token');
      await fetch('/api/admin/website-configs', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(websiteConfigs) });
      toast.success('Website atualizado!');
    } catch (e) { toast.error('Erro ao atualizar website'); }
    setIsSavingWebsite(false);
  };
  const duplicateOption = async (type: string, item: any) => {
    const token = sessionStorage.getItem('admin_token');
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

    const body = { ...item };
    delete body.id; // Remove id to create a new one
    body.nome = `${item.nome} (Cópia)`;
    if (type !== 'professores' && type !== 'parceiros') {
      delete body.type;
    }

    try {
      let url = '';
      if (type === 'professores') {
        url = '/api/professores';
      } else if (type === 'parceiros') {
        url = '/api/parceiros';
      } else {
        url = `/api/options/${type}`;
      }

      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('Erro ao duplicar');

      toast.success('Duplicado com sucesso!');
      const optRes = await fetch('/api/options', { headers });
      if (optRes.ok) setOptions(await optRes.json());
    } catch (err: any) {
      toast.error(err.message || 'Erro ao duplicar');
    }
  };
  const handleEditOption = (type: string, item: any) => {
    setEditingOption(item);
    setNewOption({ ...item, type });
  };
  const handleSaveFrete = async () => {
    setIsSavingFrete(true);
    try {
      await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'entrega_casa_habilitada', value: entregaCasaHabilitada ? 'true' : 'false' }) });
      await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'entrega_casa_preco', value: entregaCasaPreco.toString() }) });
      toast.success('Frete salvo!');
    } catch (e) { toast.error('Erro ao salvar'); }
    setIsSavingFrete(false);
  };
  const handleDragStart = (e: any, id: string) => { setDraggedId(id); };
  const handleDragOver = (e: any, id?: string) => { e.preventDefault(); };
  const handleDrop = async (e: any, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId || activeOptionsListTab !== 'turmas') {
      setDraggedId(null);
      return;
    }

    const currentList = [...options.turmas];
    const draggedIndex = currentList.findIndex(t => String(t.id) === draggedId);
    const targetIndex = currentList.findIndex(t => String(t.id) === targetId);

    if (draggedIndex < 0 || targetIndex < 0) return;

    const [removed] = currentList.splice(draggedIndex, 1);
    currentList.splice(targetIndex, 0, removed);

    const reordered = currentList.map((t, index) => ({ id: t.id, ordem: index }));

    setOptions({ ...options, turmas: currentList.map((t, i) => ({ ...t, ordem: i })) });

    try {
      const token = sessionStorage.getItem('admin_token');
      const res = await fetch('/api/options/turmas/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ orders: reordered })
      });
      if (!res.ok) throw new Error('Erro ao reordenar');
      toast.success('Ordem atualizada!');
    } catch (err) {
      toast.error('Erro ao reordenar');
      const token = sessionStorage.getItem('admin_token');
      const optRes = await fetch('/api/options', { headers: { 'Authorization': `Bearer ${token}` } });
      if (optRes.ok) setOptions(await optRes.json());
    }
    setDraggedId(null);
  };
  const handleDragEnd = () => { setDraggedId(null); };

  return (
    <div className="space-y-6">
                  {/* Sub-Tabs */}
                  <div className="flex border-b border-slate-200">
                    <button
                      onClick={() => setSettingsSubTab('geral')}
                      className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${settingsSubTab === 'geral' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                      Geral
                    </button>
                    <button
                      onClick={() => setSettingsSubTab('opcoes')}
                      className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${settingsSubTab === 'opcoes' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                      Parâmetros do Sistema (Séries, Unidades & Turmas)
                    </button>
                    <button
                      onClick={() => setSettingsSubTab('website')}
                      className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${settingsSubTab === 'website' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                      Website Institucional
                    </button>
                    <button
                      onClick={() => setSettingsSubTab('frete')}
                      className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${settingsSubTab === 'frete' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                      Frete & Loja
                    </button>
                  </div>

                  {settingsSubTab === 'geral' && (
                    <div className="space-y-6 max-w-2xl">
                      {/* Pagar.me soft descriptor */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                        <h3 className="font-bold text-slate-800">Soft Descriptor Pagar.me</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Identificador SFK</label>
                            <input type="text" value={pagarmeSoftDescriptor} onChange={e => setPagarmeSoftDescriptor(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Identificador Bernoulli</label>
                            <input type="text" value={pagarmeSoftDescriptorBernoulli} onChange={e => setPagarmeSoftDescriptorBernoulli(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                          </div>
                        </div>
                        <button onClick={saveSoftDescriptors} disabled={isSavingPagarme} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs">
                          {isSavingPagarme ? 'Salvando...' : 'Salvar Soft Descriptors'}
                        </button>
                      </div>

                      {/* Terms template */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                        <h3 className="font-bold text-slate-800">Termos de Uso / Contrato</h3>
                        <textarea value={termsTemplate} onChange={e => setTermsTemplate(e.target.value)} className="w-full h-64 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono" />
                        <button onClick={saveTermsOfUse} disabled={isSavingTerms} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs">
                          {isSavingTerms ? 'Salvando...' : 'Salvar Termos'}
                        </button>
                      </div>


                    </div>
                  )}


                  {settingsSubTab === 'opcoes' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      {/* Left Form */}
                      <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                          <h3 className="font-bold text-slate-900 mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {editingOption ? <Edit size={18} className="text-amber-600" /> : <Plus size={18} className="text-emerald-600" />}
                              {editingOption ? 'Editar Opção' : 'Adicionar Opção'}
                            </div>
                            {editingOption && (
                              <button 
                                onClick={() => {
                                  setEditingOption(null);
                                  setNewOption({
                                    type: 'series', nome: '', ordem: 0, unidade_nome: '', unidades_selecionadas: [], series_permitidas: [],
                                    idade_minima: 0, idade_maxima: 18, dias_horarios: '', valor_mensalidade: 0,
                                    capacidade: 0, local_aula: '', data_inicio: '', professor: '', status: 'ativo',
                                    logo_url: '', imagem_url: '', slug: '', parceria: '', logo_parceiro_url: '',
                                    descricao: '', foto_professor_url: '', bio: '', foto_url: '', professor_id: '',
                                    parceiro_id: '', access_type: 'Restrito a alunos'
                                  });
                                }}
                                className="text-[10px] text-amber-700 underline font-bold"
                              >
                                Cancelar
                              </button>
                            )}
                          </h3>
                          <form onSubmit={handleAddOption} className="space-y-4">
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500 uppercase">Tipo de Dado</label>
                              <select 
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                value={newOption.type}
                                onChange={e => setNewOption({...newOption, type: e.target.value as any})}
                              >
                                <option value="series">Série / Ano</option>
                                <option value="unidades">Unidade de Atendimento</option>
                                <option value="turmas">Turma Complementar</option>
                                <option value="professores">Professores</option>
                                <option value="parceiros">Parceiros</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500 uppercase">Nome / Descrição</label>
                              <input 
                                type="text" 
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="Ex: 6º Ano Fundamental"
                                value={newOption.nome}
                                onChange={e => setNewOption({...newOption, nome: e.target.value})}
                              />
                            </div>
                            {newOption.type === 'turmas' && (
                              <div className="space-y-4 pt-2 border-t border-slate-100">
                                <div className="space-y-1 relative">
                                  <label className="text-xs font-bold text-slate-500 uppercase">Unidades</label>
                                  <div 
                                    className="min-h-[42px] w-full px-3 py-2 rounded-lg border border-slate-200 bg-white cursor-pointer flex flex-wrap gap-2 items-center"
                                    onClick={() => setIsUnidadesDropdownOpen(!isUnidadesDropdownOpen)}
                                  >
                                    {newOption.unidades_selecionadas.length === 0 && (
                                      <span className="text-slate-400 text-sm">Selecione as unidades...</span>
                                    )}
                                    {newOption.unidades_selecionadas.map(unidade => (
                                      <div key={unidade} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md text-xs font-medium border border-indigo-100">
                                        {unidade}
                                        <button 
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const updated = newOption.unidades_selecionadas.filter(u => u !== unidade);
                                            setNewOption({
                                              ...newOption,
                                              unidades_selecionadas: updated,
                                              unidade_nome: updated.length > 0 ? updated[0] : ''
                                            });
                                          }}
                                          className="hover:bg-indigo-200 rounded-full p-0.5"
                                        >
                                          <X size={12} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                  
                                  {isUnidadesDropdownOpen && (
                                    <>
                                      <div className="fixed inset-0 z-10" onClick={() => setIsUnidadesDropdownOpen(false)} />
                                      <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                                        {(options.unidades || []).map((u: any) => {
                                          const uName = typeof u === 'object' && u ? u.nome : u;
                                          const isSelected = newOption.unidades_selecionadas.includes(uName);
                                          return (
                                            <div 
                                              key={uName}
                                              className="flex items-center px-4 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                                              onClick={() => {
                                                const updated = isSelected
                                                  ? newOption.unidades_selecionadas.filter(item => item !== uName)
                                                  : [...newOption.unidades_selecionadas, uName];
                                                
                                                setNewOption({
                                                  ...newOption, 
                                                  unidades_selecionadas: updated,
                                                  unidade_nome: updated.length > 0 ? updated[0] : ''
                                                });
                                              }}
                                            >
                                              <div className={`w-4 h-4 rounded border mr-3 flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                                                {isSelected && <Check size={12} className="text-white" />}
                                              </div>
                                              <span className="text-sm text-slate-700">{uName}</span>
                                              </div>
                                            );
                                        })}
                                      </div>
                                    </>
                                  )}
                                  <p className="text-[10px] text-slate-400 mt-1">Selecione todas as unidades onde esta turma é oferecida.</p>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-500 uppercase">Local da Aula</label>
                                  <input 
                                    type="text" 
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Ex: Quadra Poliesportiva"
                                    value={newOption.local_aula}
                                    onChange={e => setNewOption({...newOption, local_aula: e.target.value})}
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Idade Mínima</label>
                                    <input 
                                      type="number" 
                                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                      value={newOption.idade_minima}
                                      onChange={e => setNewOption({...newOption, idade_minima: Number(e.target.value)})}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Idade Máxima</label>
                                    <input 
                                      type="number" 
                                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                      value={newOption.idade_maxima}
                                      onChange={e => setNewOption({...newOption, idade_maxima: Number(e.target.value)})}
                                    />
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-500 uppercase">Dias e Horários</label>
                                  <input 
                                    type="text" 
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Ex: Seg e Qua - 14:00 às 15:00"
                                    value={newOption.dias_horarios}
                                    onChange={e => setNewOption({...newOption, dias_horarios: e.target.value})}
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Valor Mensalidade (R$)</label>
                                    <input 
                                      type="number" 
                                      step="0.01"
                                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                      value={newOption.valor_mensalidade}
                                      onChange={e => setNewOption({...newOption, valor_mensalidade: Number(e.target.value)})}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Capacidade</label>
                                    <input 
                                      type="number" 
                                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                      value={newOption.capacidade}
                                      onChange={e => setNewOption({...newOption, capacidade: Number(e.target.value)})}
                                    />
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-500 uppercase">Data de Início</label>
                                  <input 
                                    type="date" 
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={newOption.data_inicio}
                                    onChange={e => setNewOption({...newOption, data_inicio: e.target.value})}
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-500 uppercase">Status</label>
                                  <select 
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={newOption.status}
                                    onChange={e => setNewOption({...newOption, status: e.target.value})}
                                  >
                                    <option value="ativo">Ativo</option>
                                    <option value="inativo">Inativo</option>
                                  </select>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-500 uppercase">Professor Cadastrado (Auto-preenchimento)</label>
                                  <select 
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                    value={newOption.professor_id || ''}
                                    onChange={e => {
                                      const pId = e.target.value;
                                      const prof = (options.professores || []).find((p: any) => p.id === pId);
                                      if (prof) {
                                        setNewOption({
                                          ...newOption,
                                          professor_id: pId,
                                          professor: (prof as any).nome,
                                          foto_professor_url: (prof as any).foto_url || ''
                                        });
                                      } else {
                                        setNewOption({
                                          ...newOption,
                                          professor_id: '',
                                          professor: '',
                                          foto_professor_url: ''
                                        });
                                      }
                                    }}
                                  >
                                    <option value="">-- Selecionar Professor --</option>
                                    {(options.professores || []).map((p: any) => (
                                      <option key={p.id} value={p.id}>{p.nome}</option>
                                    ))}
                                  </select>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-500 uppercase">Professor(a) (Manual/Feedback)</label>
                                  <input 
                                    type="text" 
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Nome do professor"
                                    value={newOption.professor}
                                    onChange={e => setNewOption({...newOption, professor: e.target.value})}
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-500 uppercase">URL da Imagem da Turma</label>
                                  <input 
                                    type="text" 
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="https://exemplo.com/turma.jpg"
                                    value={newOption.imagem_url}
                                    onChange={e => setNewOption({...newOption, imagem_url: e.target.value})}
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-500 uppercase">Descrição da Turma (Landing Page)</label>
                                  <textarea 
                                    rows={3}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Descrição detalhada sobre a atividade, material e benefícios."
                                    value={newOption.descricao}
                                    onChange={e => setNewOption({...newOption, descricao: e.target.value})}
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-500 uppercase">URL da Foto do Professor (Manual/Verificação)</label>
                                  <input 
                                    type="text" 
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="https://exemplo.com/professor.jpg"
                                    value={newOption.foto_professor_url}
                                    onChange={e => setNewOption({...newOption, foto_professor_url: e.target.value})}
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-500 uppercase">Séries Permitidas</label>
                                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border border-slate-200 rounded-lg">
                                    {(options.series || []).map((s: string) => (
                                      <label key={s} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer hover:bg-slate-50 p-1 rounded">
                                        <input 
                                          type="checkbox"
                                          checked={newOption.series_permitidas.includes(s)}
                                          onChange={e => {
                                            const updated = e.target.checked 
                                              ? [...newOption.series_permitidas, s]
                                              : newOption.series_permitidas.filter(item => item !== s);
                                            setNewOption({...newOption, series_permitidas: updated});
                                          }}
                                          className="rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        {s}
                                      </label>
                                    ))}
                                  </div>
                                  <p className="text-[10px] text-slate-400">Selecione todas as séries que podem se matricular nesta turma.</p>
                                </div>
                              </div>
                            )}
                            {newOption.type === 'series' && (
                              <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Ordem de Exibição</label>
                                <input 
                                  type="number" 
                                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                  value={newOption.ordem}
                                  onChange={e => setNewOption({...newOption, ordem: Number(e.target.value)})}
                                />
                              </div>
                            )}
                             {newOption.type === 'unidades' && (
                               <div className="space-y-3 pt-2 border-t border-slate-100">
                                 <div className="space-y-1">
                                   <label className="text-xs font-bold text-slate-500 uppercase">URL do Slug (URL amigável)</label>
                                   <input 
                                     type="text" 
                                     className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                     placeholder="ex: bernoulli"
                                     value={newOption.slug}
                                     onChange={e => setNewOption({...newOption, slug: e.target.value})}
                                   />
                                 </div>
                                 <div className="space-y-1">
                                   <label className="text-xs font-bold text-slate-500 uppercase">Parceiro Cadastrado (Auto-preenchimento)</label>
                                   <select 
                                     className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                     value={newOption.parceiro_id || ''}
                                     onChange={e => {
                                       const pId = e.target.value;
                                       const parc = (options.parceiros || []).find((p: any) => p.id === pId);
                                       if (parc) {
                                         setNewOption({
                                           ...newOption,
                                           parceiro_id: pId,
                                           parceria: (parc as any).nome,
                                           logo_parceiro_url: (parc as any).logo_url || ''
                                         });
                                       } else {
                                         setNewOption({
                                           ...newOption,
                                           parceiro_id: '',
                                           parceria: '',
                                           logo_parceiro_url: ''
                                         });
                                       }
                                     }}
                                   >
                                     <option value="">-- Selecionar Parceiro --</option>
                                     {(options.parceiros || []).map((p: any) => (
                                       <option key={p.id} value={p.id}>{p.nome}</option>
                                     ))}
                                   </select>
                                 </div>

                                 <div className="space-y-1">
                                   <label className="text-xs font-bold text-slate-500 uppercase">Parceria (ex: Bernoulli+) (Manual/Verificação)</label>
                                   <input 
                                     type="text" 
                                     className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                     placeholder="ex: Bernoulli+"
                                     value={newOption.parceria}
                                     onChange={e => setNewOption({...newOption, parceria: e.target.value})}
                                   />
                                 </div>
                                 <div className="space-y-1">
                                   <label className="text-xs font-bold text-slate-500 uppercase">URL do Logo do Parceiro (Manual/Verificação)</label>
                                   <input 
                                     type="text" 
                                     className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                     placeholder="https://exemplo.com/logo-parceiro.png"
                                     value={newOption.logo_parceiro_url}
                                     onChange={e => setNewOption({...newOption, logo_parceiro_url: e.target.value})}
                                   />
                                 </div>
                                 <div className="space-y-1">
                                   <label className="text-xs font-bold text-slate-500 uppercase">URL do Logo (Premium)</label>
                                   <input 
                                     type="text" 
                                     className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                     placeholder="https://exemplo.com/logo.png"
                                     value={newOption.logo_url}
                                     onChange={e => setNewOption({...newOption, logo_url: e.target.value})}
                                   />
                                 </div>
                                 <div className="space-y-1">
                                   <label className="text-xs font-bold text-slate-500 uppercase">URL da Imagem Banner</label>
                                   <input 
                                     type="text" 
                                     className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                     placeholder="https://exemplo.com/banner.jpg"
                                     value={newOption.imagem_url}
                                     onChange={e => setNewOption({...newOption, imagem_url: e.target.value})}
                                   />
                                 </div>
                                 <div className="space-y-1">
                                   <label className="text-xs font-bold text-slate-500 uppercase">Acesso ao Portal</label>
                                   <select
                                     className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                     value={newOption.access_type}
                                     onChange={e => setNewOption({...newOption, access_type: e.target.value})}
                                   >
                                     <option value="Restrito a alunos">Restrito a alunos</option>
                                     <option value="Aberto ao Público Externo">Aberto ao Público Externo</option>
                                   </select>
                                 </div>
                               </div>
                             )}

                             {newOption.type === 'professores' && (
                               <div className="space-y-3 pt-2 border-t border-slate-100">
                                 <div className="space-y-1">
                                   <label className="text-xs font-bold text-slate-500 uppercase">URL da Foto</label>
                                   <input 
                                     type="text" 
                                     className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                     placeholder="https://exemplo.com/foto-professor.jpg"
                                     value={newOption.foto_url}
                                     onChange={e => setNewOption({...newOption, foto_url: e.target.value})}
                                   />
                                 </div>
                                 <div className="space-y-1">
                                   <label className="text-xs font-bold text-slate-500 uppercase">Biografia (Bio)</label>
                                   <textarea 
                                     rows={3}
                                     className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                     placeholder="Breve biografia do professor."
                                     value={newOption.bio}
                                     onChange={e => setNewOption({...newOption, bio: e.target.value})}
                                   />
                                 </div>
                               </div>
                             )}

                             {newOption.type === 'parceiros' && (
                               <div className="space-y-3 pt-2 border-t border-slate-100">
                                 <div className="space-y-1">
                                   <label className="text-xs font-bold text-slate-500 uppercase">URL do Logo</label>
                                   <input 
                                     type="text" 
                                     className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                     placeholder="https://exemplo.com/logo-parceiro.png"
                                     value={newOption.logo_url}
                                     onChange={e => setNewOption({...newOption, logo_url: e.target.value})}
                                   />
                                 </div>
                               </div>
                             )}
                            <button 
                              type="submit"
                              className={`w-full ${editingOption ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2`}
                            >
                              {editingOption ? 'Atualizar' : 'Salvar'} <Save size={16} />
                            </button>
                          </form>
                        </div>
                      </div>

                      {/* Right List */}
                      <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                            <h3 className="font-bold text-slate-900">Visualização das Listas</h3>
                            <div className="flex border-b border-slate-100">
                              <button 
                                onClick={() => { setActiveOptionsListTab('series'); setOptionsFilterSearch(''); setOptionsFilterUnidade(''); setOptionsFilterProfessor(''); }}
                                className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${activeOptionsListTab === 'series' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                              >
                                Séries ({options.series?.length || 0})
                              </button>
                              <button 
                                onClick={() => { setActiveOptionsListTab('unidades'); setOptionsFilterSearch(''); setOptionsFilterUnidade(''); setOptionsFilterProfessor(''); }}
                                className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${activeOptionsListTab === 'unidades' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                              >
                                Unidades ({options.unidades?.length || 0})
                              </button>
                              <button 
                                onClick={() => { setActiveOptionsListTab('turmas'); setOptionsFilterSearch(''); setOptionsFilterUnidade(''); setOptionsFilterProfessor(''); }}
                                className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${activeOptionsListTab === 'turmas' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                              >
                                Turmas ({options.turmas?.length || 0})
                              </button>
                              <button 
                                onClick={() => { setActiveOptionsListTab('professores'); setOptionsFilterSearch(''); setOptionsFilterUnidade(''); setOptionsFilterProfessor(''); }}
                                className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${activeOptionsListTab === 'professores' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                              >
                                Professores ({options.professores?.length || 0})
                              </button>
                              <button 
                                onClick={() => { setActiveOptionsListTab('parceiros'); setOptionsFilterSearch(''); setOptionsFilterUnidade(''); setOptionsFilterProfessor(''); }}
                                className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${activeOptionsListTab === 'parceiros' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                              >
                                Parceiros ({options.parceiros?.length || 0})
                              </button>
                            </div>
                          </div>

                          {/* Search & Filter Bar */}
                          <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-100 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className={`${activeOptionsListTab === 'turmas' ? 'md:col-span-1' : 'md:col-span-3'} relative`}>
                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                                  <Search size={16} />
                                </span>
                                <input 
                                  type="text"
                                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 font-medium"
                                  placeholder="Buscar pelo nome..."
                                  value={optionsFilterSearch}
                                  onChange={e => setOptionsFilterSearch(e.target.value)}
                                />
                              </div>
                              {activeOptionsListTab === 'turmas' && (
                                <>
                                  <div>
                                    <select
                                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                                      value={optionsFilterUnidade}
                                      onChange={e => setOptionsFilterUnidade(e.target.value)}
                                    >
                                      <option value="">Todas as Unidades</option>
                                      {(options.unidades || []).map((u: any) => {
                                        const uName = typeof u === 'object' && u ? u.nome : u;
                                        return <option key={uName} value={uName}>{uName}</option>;
                                      })}
                                    </select>
                                  </div>
                                  <div>
                                    <select
                                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                                      value={optionsFilterProfessor}
                                      onChange={e => setOptionsFilterProfessor(e.target.value)}
                                    >
                                      <option value="">Todos os Professores</option>
                                      {(options.professores || []).map((p: any) => (
                                        <option key={p.id} value={p.nome}>{p.nome}</option>
                                      ))}
                                    </select>
                                  </div>
                                </>
                              )}
                            </div>
                            {activeOptionsListTab === 'turmas' && (
                              <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1 font-medium bg-slate-50 border border-slate-100 rounded px-2.5 py-1 w-max">
                                <span className="text-amber-500 font-bold">💡 Dica:</span>
                                Arraste e solte as turmas para reordenar a exibição nos portais das unidades.
                              </div>
                            )}
                          </div>

                          {activeOptionsListTab === 'series' && (
                            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto pr-2">
                              {(options.series || []).filter((s: any) => {
                                const sName = typeof s === 'object' && s ? s.nome : s;
                                return typeof sName === 'string' && sName.toLowerCase().includes(optionsFilterSearch.toLowerCase());
                              }).map((s: any) => {
                                const sName = typeof s === 'object' && s ? s.nome : s;
                                return (
                                <div key={sName} className="py-3 flex items-center justify-between">
                                  <span className="text-sm font-medium text-slate-700">{sName}</span>
                                  <div className="flex items-center gap-2">
                                    <button 
                                      onClick={() => handleEditOption('series', typeof s === 'object' && s ? s : { nome: s })}
                                      className="p-1.5 text-slate-400 hover:text-amber-600 transition-colors"
                                      title="Editar"
                                    >
                                      <Edit size={14} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteOption('series', sName)}
                                      className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                                      title="Excluir"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                                );
                              })}
                            </div>
                          )}

                          {activeOptionsListTab === 'unidades' && (
                            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto pr-2">
                              {(options.unidades || []).filter((u: any) => {
                                const uName = typeof u === 'object' && u ? u.nome : u;
                                return typeof uName === 'string' && uName.toLowerCase().includes(optionsFilterSearch.toLowerCase());
                              }).map((u: any) => {
                                const uName = typeof u === 'object' && u ? u.nome : u;
                                const logo = typeof u === 'object' && u ? u.logo_url : null;
                                const banner = typeof u === 'object' && u ? u.imagem_url : null;
                                return (
                                  <div key={uName} className="py-3 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                      {logo ? (
                                        <img src={logo} alt="logo" className="w-8 h-8 rounded-lg object-contain border border-slate-100" />
                                      ) : (
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] text-slate-400">
                                          Logo
                                        </div>
                                      )}
                                      <div>
                                        <span className="text-sm font-medium text-slate-700 block">{uName}</span>
                                        {banner && <span className="text-[10px] text-slate-400 truncate max-w-xs block">Banner: {banner}</span>}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button 
                                        onClick={() => handleEditOption('unidades', typeof u === 'object' && u ? u : { nome: u })}
                                        className="p-1.5 text-slate-400 hover:text-amber-600 transition-colors"
                                        title="Editar"
                                      >
                                        <Edit size={14} />
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteOption('unidades', uName)}
                                        className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                                        title="Excluir"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </div>
                                    );
                              })}
                            </div>
                          )}

                          {activeOptionsListTab === 'turmas' && (
                            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto pr-2">
                              {(options.turmas || [])
                                .filter((t: any) => {
                                  const matchesSearch = t.nome.toLowerCase().includes(optionsFilterSearch.toLowerCase());
                                  const matchesUnidade = !optionsFilterUnidade || (t.unidades_selecionadas?.includes(optionsFilterUnidade) || t.unidade_nome === optionsFilterUnidade);
                                  const matchesProfessor = !optionsFilterProfessor || t.professor === optionsFilterProfessor;
                                  return matchesSearch && matchesUnidade && matchesProfessor;
                                })
                                .map((t: any) => (
                                <div 
                                  key={t.nome} 
                                  draggable={true}
                                  onDragStart={(e) => handleDragStart(e, t.id)}
                                  onDragOver={(e) => handleDragOver(e, t.id)}
                                  onDrop={(e) => handleDrop(e, t.id)}
                                  onDragEnd={handleDragEnd}
                                  className={`py-4 flex items-start justify-between gap-4 transition-all duration-200 ${
                                    draggedId === t.id 
                                      ? 'opacity-30 bg-slate-50 border border-dashed border-slate-300 rounded-lg p-2' 
                                      : 'hover:bg-slate-50/50'
                                  }`}
                                >
                                  <div className="flex gap-3 items-center">
                                    <div 
                                      className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 p-1 rounded transition-colors shrink-0"
                                      title="Arraste para reordenar"
                                    >
                                      <GripVertical size={16} />
                                    </div>
                                    {t.imagem_url ? (
                                      <img src={t.imagem_url} alt="turma" className="w-12 h-12 rounded-xl object-cover border border-slate-150 shrink-0" />
                                    ) : (
                                      <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] text-slate-400 shrink-0">
                                        Sem Foto
                                      </div>
                                    )}
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-slate-800">{t.nome}</span>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${t.status === 'ativo' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                                          {t.status === 'ativo' ? 'Ativo' : 'Inativo'}
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 mt-0.5">
                                        {(t.unidades_selecionadas?.length > 0 ? t.unidades_selecionadas : [t.unidade_nome]).filter(Boolean).map((uName: string, i: number) => (
                                          <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-medium border border-slate-200">
                                            {uName}
                                          </span>
                                        ))}
                                        {t.local_aula && <span className="text-[10px] text-slate-500 font-medium self-center ml-1">({t.local_aula})</span>}
                                      </div>
                                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
                                        <span>Horário: <strong>{t.dias_horarios}</strong></span>
                                        <span>Mensalidade: <strong>R$ {t.valor_mensalidade?.toFixed(2)}</strong></span>
                                        <span>Idades: <strong>{t.idade_minima} a {t.idade_maxima} anos</strong></span>
                                        <span>Vagas: <strong>{t.ocupacao_atual || 0}/{t.capacidade}</strong></span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button 
                                      onClick={() => handleEditOption('turmas', t)}
                                      className="p-1.5 text-slate-400 hover:text-amber-600 transition-colors"
                                      title="Editar"
                                    >
                                      <Edit size={14} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteOption('turmas', t.nome)}
                                      className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                                      title="Excluir"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {activeOptionsListTab === 'professores' && (
                            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto pr-2">
                              {(options.professores || []).filter((p: any) => p.nome.toLowerCase().includes(optionsFilterSearch.toLowerCase())).map((p: any) => (
                                <div key={p.id} className="py-3 flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-3">
                                    {p.foto_url ? (
                                      <img src={p.foto_url} alt={p.nome} className="w-10 h-10 rounded-full object-cover border border-slate-100" />
                                    ) : (
                                      <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] text-slate-400">
                                        Sem Foto
                                      </div>
                                    )}
                                    <div>
                                      <span className="text-sm font-medium text-slate-700 block">{p.nome}</span>
                                      {p.bio && <p className="text-xs text-slate-400 line-clamp-1">{p.bio}</p>}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button 
                                      onClick={() => handleEditOption('professores', p)}
                                      className="p-1.5 text-slate-400 hover:text-amber-600 transition-colors"
                                      title="Editar"
                                    >
                                      <Edit size={14} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteOption('professores', p.nome, p.id)}
                                      className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                                      title="Excluir"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {activeOptionsListTab === 'parceiros' && (
                            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto pr-2">
                              {(options.parceiros || []).filter((p: any) => p.nome.toLowerCase().includes(optionsFilterSearch.toLowerCase())).map((p: any) => (
                                <div key={p.id} className="py-3 flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-3">
                                    {p.logo_url ? (
                                      <img src={p.logo_url} alt={p.nome} className="w-10 h-10 rounded-lg object-contain border border-slate-100" />
                                    ) : (
                                      <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] text-slate-400">
                                        Sem Logo
                                      </div>
                                    )}
                                    <div>
                                      <span className="text-sm font-medium text-slate-700 block">{p.nome}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button 
                                      onClick={() => handleEditOption('parceiros', p)}
                                      className="p-1.5 text-slate-400 hover:text-amber-600 transition-colors"
                                      title="Editar"
                                    >
                                      <Edit size={14} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteOption('parceiros', p.nome, p.id)}
                                      className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                                      title="Excluir"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                        </div>
                      </div>
                    </div>
                  )}
                  {settingsSubTab === 'frete' && (
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 max-w-2xl">
                      <h3 className="font-bold text-slate-800">Configurações de Entrega (Loja)</h3>
                      <div className="space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={entregaCasaHabilitada} 
                            onChange={e => setEntregaCasaHabilitada(e.target.checked)} 
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                          />
                          <span className="text-sm font-semibold text-slate-700">Habilitar Entrega em Casa</span>
                        </label>
                        {entregaCasaHabilitada && (
                          <div className="max-w-xs">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Preço da Entrega (R$)</label>
                            <input 
                              type="number" 
                              step="0.01" 
                              min="0" 
                              value={entregaCasaPreco} 
                              onChange={e => setEntregaCasaPreco(Number(e.target.value))} 
                              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" 
                            />
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={handleSaveFrete} 
                        disabled={isSavingFrete} 
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs"
                      >
                        {isSavingFrete ? 'Salvando...' : 'Salvar Configurações de Frete'}
                      </button>
                    </div>
                  )}

                  {settingsSubTab === 'website' && (
                    <div className="space-y-6 animate-fade-in">
                      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-bold text-slate-900 mb-1">Configurações do Website</h3>
                            <p className="text-xs text-slate-500">Gerencie o conteúdo da página inicial (Landing Page).</p>
                          </div>
                          <button
                            onClick={async () => {
                              setIsSavingWebsite(true);
                              try {
                                const res = await fetch('/api/admin/website-configs', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${sessionStorage.getItem('admin_token')}`
                                  },
                                  body: JSON.stringify(websiteConfigs)
                                });
                                const data = await res.json().catch(() => ({}));
                                if (!res.ok) {
                                  throw new Error(data.error || 'Erro ao salvar configurações do website');
                                }
                                toast.success('Configurações salvas com sucesso!');
                              } catch (err: any) {
                                console.error(err);
                                toast.error(err.message || 'Erro ao salvar');
                              } finally {
                                setIsSavingWebsite(false);
                              }
                            }}
                            disabled={isSavingWebsite}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm"
                          >
                            {isSavingWebsite ? 'Salvando...' : 'Salvar Configurações'}
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-8">
                          
                          {/* CABEÇALHO */}
                          <div className="space-y-4">
                            <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                              <Layers className="w-4 h-4 text-indigo-500" /> Logo do Cabeçalho
                            </h4>
                            <div>
                              <label className="text-xs font-bold text-slate-500 uppercase">URL da Logomarca (Deixe vazio para usar a logo do Tema)</label>
                              <input 
                                type="text" 
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                value={websiteConfigs.header_logo_url || ''}
                                onChange={e => setWebsiteConfigs({...websiteConfigs, header_logo_url: e.target.value})}
                                placeholder="https://..."
                              />
                            </div>
                            <div>
                              <label className="text-xs font-bold text-slate-500 uppercase">Tamanho da Logomarca (Altura)</label>
                              <select 
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500 mt-1"
                                value={websiteConfigs.header_logo_size || 'h-16'}
                                onChange={e => setWebsiteConfigs({...websiteConfigs, header_logo_size: e.target.value})}
                              >
                                <option value="h-8">Muito Pequeno (32px)</option>
                                <option value="h-10">Pequeno (40px)</option>
                                <option value="h-12">Médio (48px)</option>
                                <option value="h-14">Médio Grande (56px)</option>
                                <option value="h-16">Grande (64px)</option>
                                <option value="h-20">Muito Grande (80px)</option>
                                <option value="h-24">Gigante (96px)</option>
                              </select>
                            </div>
                          </div>

                          {/* TEXTO PADRÃO (FALLBACK) */}
                          <div className="space-y-4">
                            <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                              <Layers className="w-4 h-4 text-indigo-500" /> Banner Padrão (Sem Carrossel)
                            </h4>
                            <div>
                              <label className="text-xs font-bold text-slate-500 uppercase">Título Principal</label>
                              <input 
                                type="text" 
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500 mt-1 block"
                                value={websiteConfigs.banner_title || ''}
                                onChange={e => setWebsiteConfigs({...websiteConfigs, banner_title: e.target.value})}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-bold text-slate-500 uppercase">Subtítulo</label>
                              <textarea 
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500 mt-1 block"
                                rows={2}
                                value={websiteConfigs.banner_subtitle || ''}
                                onChange={e => setWebsiteConfigs({...websiteConfigs, banner_subtitle: e.target.value})}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-bold text-slate-500 uppercase">URL da Imagem de Fundo</label>
                              <input 
                                type="text" 
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500 mt-1 block"
                                value={websiteConfigs.banner_url || ''}
                                onChange={e => setWebsiteConfigs({...websiteConfigs, banner_url: e.target.value})}
                              />
                            </div>
                          </div>

                          {/* CARROSSEL HERO */}
                          <div className="space-y-4">
                            <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                              <Star className="w-4 h-4 text-indigo-500" /> Carrossel do Banner Principal
                            </h4>
                            
                            <div>
                              <label className="text-xs font-bold text-slate-500 uppercase">Tempo de Transição (Segundos)</label>
                              <input 
                                type="number" 
                                className="w-32 px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                value={websiteConfigs.hero_transition_time || 5}
                                onChange={e => setWebsiteConfigs({...websiteConfigs, hero_transition_time: parseInt(e.target.value) || 5})}
                              />
                            </div>

                            <div className="space-y-3">
                              {(websiteConfigs.hero_carousel || []).map((slide: any, idx: number) => (
                                <div key={idx} className="p-4 border border-slate-200 rounded-lg space-y-3 bg-slate-50">
                                  <div className="flex justify-between items-center">
                                    <span className="font-bold text-xs text-slate-500 uppercase">Slide {idx + 1}</span>
                                    <button 
                                      className="text-red-500 hover:text-red-700 p-1"
                                      onClick={() => {
                                        const novaLista = [...(websiteConfigs.hero_carousel || [])];
                                        novaLista.splice(idx, 1);
                                        setWebsiteConfigs({ ...websiteConfigs, hero_carousel: novaLista });
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                  <input type="text" placeholder="URL da Imagem de Fundo" className="w-full px-3 py-2 rounded border border-slate-200 text-sm" value={slide.image_url || ''} onChange={e => { const nl = [...websiteConfigs.hero_carousel]; nl[idx].image_url = e.target.value; setWebsiteConfigs({ ...websiteConfigs, hero_carousel: nl }); }} />
                                  <input type="text" placeholder="Título" className="w-full px-3 py-2 rounded border border-slate-200 text-sm" value={slide.title || ''} onChange={e => { const nl = [...websiteConfigs.hero_carousel]; nl[idx].title = e.target.value; setWebsiteConfigs({ ...websiteConfigs, hero_carousel: nl }); }} />
                                  <input type="text" placeholder="Subtítulo" className="w-full px-3 py-2 rounded border border-slate-200 text-sm" value={slide.subtitle || ''} onChange={e => { const nl = [...websiteConfigs.hero_carousel]; nl[idx].subtitle = e.target.value; setWebsiteConfigs({ ...websiteConfigs, hero_carousel: nl }); }} />
                                </div>
                              ))}
                              <button 
                                className="flex items-center gap-2 text-sm text-indigo-600 font-medium hover:text-indigo-800"
                                onClick={() => {
                                  const novaLista = [...(websiteConfigs.hero_carousel || []), { image_url: '', title: '', subtitle: '' }];
                                  setWebsiteConfigs({ ...websiteConfigs, hero_carousel: novaLista });
                                }}
                              >
                                <Plus className="w-4 h-4" /> Adicionar Slide
                              </button>
                            </div>
                          </div>
                          

                          {/* SEÇÃO DEPOIMENTOS */}
                          <div className="space-y-4">
                            <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                              <MessageSquare className="w-4 h-4 text-indigo-500" /> Depoimentos
                            </h4>
                            
                            <div>
                              <label className="text-xs font-bold text-slate-500 uppercase">Velocidade do Carrossel (Segundos para uma volta completa)</label>
                              <input 
                                type="number" 
                                className="w-64 px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500 mt-1 block"
                                value={websiteConfigs.testimonials_speed || ''}
                                onChange={e => setWebsiteConfigs({...websiteConfigs, testimonials_speed: parseInt(e.target.value) || null})}
                                placeholder="Padrão automático"
                              />
                            </div>

                            <div className="space-y-3">
                              {(websiteConfigs.testimonials || []).map((testim: any, idx: number) => (
                                <div key={idx} className="p-4 border border-slate-200 rounded-lg space-y-3 bg-slate-50">
                                  <div className="flex justify-between items-center">
                                    <span className="font-bold text-xs text-slate-500 uppercase">Depoimento {idx + 1}</span>
                                    <button 
                                      className="text-red-500 hover:text-red-700 p-1"
                                      onClick={() => {
                                        const novaLista = [...(websiteConfigs.testimonials || [])];
                                        novaLista.splice(idx, 1);
                                        setWebsiteConfigs({ ...websiteConfigs, testimonials: novaLista });
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                  <input type="text" placeholder="Nome do Cliente" className="w-full px-3 py-2 rounded border border-slate-200 text-sm" value={testim.name || ''} onChange={e => { const nl = [...websiteConfigs.testimonials]; nl[idx].name = e.target.value; setWebsiteConfigs({ ...websiteConfigs, testimonials: nl }); }} />
                                  <textarea placeholder="Texto do depoimento..." rows={3} className="w-full px-3 py-2 rounded border border-slate-200 text-sm" value={testim.text || ''} onChange={e => { const nl = [...websiteConfigs.testimonials]; nl[idx].text = e.target.value; setWebsiteConfigs({ ...websiteConfigs, testimonials: nl }); }} />
                                  <div className="grid grid-cols-2 gap-3">
                                    <input type="text" placeholder="Cargo/Relação (ex: Mãe do João)" className="w-full px-3 py-2 rounded border border-slate-200 text-sm" value={testim.role || ''} onChange={e => { const nl = [...websiteConfigs.testimonials]; nl[idx].role = e.target.value; setWebsiteConfigs({ ...websiteConfigs, testimonials: nl }); }} />
                                    <select className="w-full px-3 py-2 rounded border border-slate-200 text-sm outline-none" value={testim.rating || 5} onChange={e => { const nl = [...websiteConfigs.testimonials]; nl[idx].rating = parseInt(e.target.value); setWebsiteConfigs({ ...websiteConfigs, testimonials: nl }); }}>
                                      <option value={5}>5 Estrelas</option>
                                      <option value={4}>4 Estrelas</option>
                                      <option value={3}>3 Estrelas</option>
                                      <option value={2}>2 Estrelas</option>
                                      <option value={1}>1 Estrela</option>
                                    </select>
                                  </div>
                                </div>
                              ))}
                              <button 
                                className="flex items-center gap-2 text-sm text-indigo-600 font-medium hover:text-indigo-800"
                                onClick={() => {
                                  const novaLista = [...(websiteConfigs.testimonials || []), { name: '', text: '', role: '', rating: 5 }];
                                  setWebsiteConfigs({ ...websiteConfigs, testimonials: novaLista });
                                }}
                              >
                                <Plus className="w-4 h-4" /> Adicionar Depoimento
                              </button>
                            </div>
                          </div>

                        </div>

                        <div className="pt-4 border-t border-slate-100 flex justify-end">
                          <button
                            onClick={async () => {
                              setIsSavingWebsite(true);
                              try {
                                const res = await fetch('/api/admin/website-configs', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${sessionStorage.getItem('admin_token')}`
                                  },
                                  body: JSON.stringify(websiteConfigs)
                                });
                                const data = await res.json().catch(() => ({}));
                                if (!res.ok) {
                                  throw new Error(data.error || 'Erro ao salvar configurações do website');
                                }
                                toast.success('Configurações salvas com sucesso!');
                              } catch (err: any) {
                                console.error(err);
                                toast.error(err.message || 'Erro ao salvar');
                              } finally {
                                setIsSavingWebsite(false);
                              }
                            }}
                            disabled={isSavingWebsite}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold text-sm transition-colors"
                          >
                            {isSavingWebsite ? 'Salvando...' : 'Salvar Configurações'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

    </div>
  );
}