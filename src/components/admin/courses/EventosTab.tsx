import React, { useState, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Edit2, Trash2, Calendar, MapPin, X, Check, Users, Map
} from 'lucide-react';
import { useAdminStore } from '../../../stores/adminStore';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';
import JoditEditor from 'jodit-react';

interface Evento {
  id: string;
  titulo: string;
  slug: string;
  descricao: string;
  data_inicio: string;
  data_fim: string;
  prazo_inscricao: string;
  vagas_total?: number | null;
  taxa_inscricao: number;
  gratuito: boolean;
  status: string;
  local: string;
  unidade_nome: string;
  categorias_inscricao: string[];
  apenas_alunos: boolean;
  tipo_preco: 'gratuito' | 'fixo' | 'por_categoria';
  opcoes_precos: any[];
  campos_personalizados: any[];
  tipo: 'evento' | 'curso' | 'colonia';
  imagem_capa?: string;
  imagem_banner?: string;
}

export function EventosTab() {
  const { eventos, setEventos, options, loadData } = useAdminStore();
  
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  const [eventoForm, setEventoForm] = useState<Partial<Evento>>({
    titulo: '', slug: '', tipo: 'evento', descricao: '',
    data_inicio: '', data_fim: '', prazo_inscricao: '', local: '', unidade_nome: 'Master',
    vagas_total: null, taxa_inscricao: 0, gratuito: true, status: 'publicado',
    categorias_inscricao: [], apenas_alunos: true,
    tipo_preco: 'gratuito', opcoes_precos: [], campos_personalizados: []
  });

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newPriceOptionName, setNewPriceOptionName] = useState('');
  const [newPriceOptionPrice, setNewPriceOptionPrice] = useState<number>(0);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldTipo, setNewFieldTipo] = useState<'texto'|'numero'|'select'|'data'|'textarea'>('texto');
  const [newFieldOpcoes, setNewFieldOpcoes] = useState('');
  const [newFieldObrigatorio, setNewFieldObrigatorio] = useState(false);

  const handleEventoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = sessionStorage.getItem('admin_token');
    const headers = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };

    try {
      const url = selectedId ? `/api/admin/eventos/${selectedId}` : '/api/admin/eventos';
      const method = selectedId ? 'PUT' : 'POST';

      const payload = { ...eventoForm };
      if (payload.data_inicio) payload.data_inicio = new Date(payload.data_inicio).toISOString();
      if (payload.data_fim) payload.data_fim = new Date(payload.data_fim).toISOString();
      if (payload.prazo_inscricao) payload.prazo_inscricao = new Date(payload.prazo_inscricao).toISOString();

      const res = await fetch(url, { method, headers, body: JSON.stringify(payload) });
      if (res.ok) {
        toast.success('Evento salvo com sucesso!');
        setIsEditing(false);
        setSelectedId(null);
        loadData();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao salvar evento.');
      }
    } catch {
      toast.error('Erro de rede.');
    }
  };

  const handleDeleteEvento = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este evento? Esta ação não pode ser desfeita.')) return;
    
    const token = sessionStorage.getItem('admin_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    try {
      const res = await fetch(`/api/admin/eventos/${id}`, { method: 'DELETE', headers });
      if (res.ok) {
        toast.success('Evento excluído com sucesso!');
        loadData();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao excluir evento.');
      }
    } catch {
      toast.error('Erro de rede ao excluir evento.');
    }
  };



  const handleEditEvento = (evento: Evento) => {
    setEventoForm({
      ...evento,
      data_inicio: evento.data_inicio ? evento.data_inicio.substring(0, 16) : '',
      data_fim: evento.data_fim ? evento.data_fim.substring(0, 16) : '',
      prazo_inscricao: evento.prazo_inscricao ? evento.prazo_inscricao.substring(0, 16) : ''
    });
    setSelectedId(evento.id);
    setIsEditing(true);
  };

  const addPriceOption = () => {
    setEventoForm({
      ...eventoForm,
      opcoes_precos: [...(eventoForm.opcoes_precos || []), { nome: '', preco: 0 }]
    });
  };

  const removePriceOption = (idx: number) => {
    const current = [...(eventoForm.opcoes_precos || [])];
    current.splice(idx, 1);
    setEventoForm({ ...eventoForm, opcoes_precos: current });
  };

  const addCategoryTag = (tag: string) => {
    if (!tag) return;
    const current = new Set(eventoForm.categorias_inscricao || []);
    current.add(tag);
    setEventoForm({ ...eventoForm, categorias_inscricao: Array.from(current) });
  };

  const removeCategoryTag = (tag: string) => {
    const current = new Set(eventoForm.categorias_inscricao || []);
    current.delete(tag);
    setEventoForm({ ...eventoForm, categorias_inscricao: Array.from(current) });
  };


  return (

    <>
      {/* MODAL DE EVENTOS */}
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
                {selectedId ? 'Editar Evento/Curso' : 'Novo Evento/Curso'}
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(100vh-200px)]">

                <form id="event-edit-form" onSubmit={handleEventoSubmit} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título do Evento</label>
                      <input type="text" required value={eventoForm.titulo || ''} onChange={e => setEventoForm({ ...eventoForm, titulo: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-700" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Slug (URL)</label>
                      <input type="text" required value={eventoForm.slug || ''} onChange={e => setEventoForm({ ...eventoForm, slug: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-700" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo</label>
                      <select required value={eventoForm.tipo || 'evento'} onChange={e => setEventoForm({ ...eventoForm, tipo: e.target.value as any })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-700">
                        <option value="evento">Evento Geral</option>
                        <option value="competicao">Competição / Torneio</option>
                        <option value="apresentacao">Apresentação / Festival</option>
                        <option value="workshop">Workshop / Clínica</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Início do Evento</label>
                      <input type="datetime-local" required value={eventoForm.data_inicio || ''} onChange={e => setEventoForm({ ...eventoForm, data_inicio: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-700" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fim do Evento</label>
                      <input type="datetime-local" value={eventoForm.data_fim || ''} onChange={e => setEventoForm({ ...eventoForm, data_fim: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-700" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Prazo Fim de Inscrição</label>
                      <input type="datetime-local" value={eventoForm.prazo_inscricao || ''} onChange={e => setEventoForm({ ...eventoForm, prazo_inscricao: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-700" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Local</label>
                      <input type="text" value={eventoForm.local || ''} onChange={e => setEventoForm({ ...eventoForm, local: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-700" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vagas Totais</label>
                      <input type="number" min="1" value={eventoForm.vagas_total === null || eventoForm.vagas_total === undefined ? '' : eventoForm.vagas_total} onChange={e => setEventoForm({ ...eventoForm, vagas_total: e.target.value === '' ? null : Number(e.target.value) })} placeholder="Ilimitadas" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-700" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">URL da Imagem de Capa (Proporção Card)</label>
                      <input type="text" value={eventoForm.imagem_capa || ''} onChange={e => setEventoForm({ ...eventoForm, imagem_capa: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-700" placeholder="https://..." />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">URL da Imagem de Banner (Proporção Larga)</label>
                      <input type="text" value={eventoForm.imagem_banner || ''} onChange={e => setEventoForm({ ...eventoForm, imagem_banner: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-700" placeholder="https://..." />
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição do Evento</label>
                    <JoditEditor
                      value={eventoForm.descricao || ''}
                      config={{
                        readonly: false,
                        placeholder: 'Escreva a descrição do evento aqui...',
                        height: 300,
                        toolbarSticky: false,
                        buttons: [
                          'bold', 'italic', 'underline', 'strikethrough', '|',
                          'font', 'fontsize', 'brush', 'paragraph', '|',
                          'image', 'table', 'link', '|',
                          'align', 'undo', 'redo', 'hr', 'eraser', 'fullsize'
                        ]
                      }}
                      onBlur={newContent => setEventoForm({ ...eventoForm, descricao: newContent })}
                    />
                  </div>

                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                    <h4 className="font-bold text-slate-800 text-sm">Configuração de Inscrição e Valores</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Modelo de Inscrição</label>
                        <select 
                          value={eventoForm.tipo_preco || 'gratuito'} 
                          onChange={e => {
                            const val = e.target.value as 'gratuito' | 'fixo' | 'categorias';
                            setEventoForm({
                              ...eventoForm,
                              tipo_preco: val,
                              gratuito: val === 'gratuito',
                              taxa_inscricao: val === 'fixo' ? Number(eventoForm.taxa_inscricao || 0) : 0
                            });
                          }} 
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-700"
                        >
                          <option value="gratuito">Gratuita</option>
                          <option value="fixo">Taxa Fixa</option>
                          <option value="categorias">Por Categoria de Preço</option>
                        </select>
                      </div>

                      {eventoForm.tipo_preco === 'fixo' && (
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Taxa de Inscrição (R$)</label>
                          <input 
                            type="number" 
                            step="0.01" 
                            value={eventoForm.taxa_inscricao || 0} 
                            onChange={e => setEventoForm({ ...eventoForm, taxa_inscricao: Number(e.target.value) })} 
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-700" 
                          />
                        </div>
                      )}
                    </div>

                      {eventoForm.tipo_preco === 'por_categoria' && (
                      <div className="space-y-3 pt-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase">Gerenciar Categorias de Preço</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Nome (Ex: Adulto, Kit Atleta)" 
                            value={newPriceOptionName} 
                            onChange={e => setNewPriceOptionName(e.target.value)} 
                            className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800" 
                          />
                          <input 
                            type="number" 
                            step="0.01" 
                            placeholder="Preço (R$)" 
                            value={newPriceOptionPrice || ''} 
                            onChange={e => setNewPriceOptionPrice(Number(e.target.value))} 
                            className="w-28 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800" 
                          />
                          <button 
                            type="button" 
                            onClick={addPriceOption} 
                            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
                          >
                            Adicionar
                          </button>
                        </div>

                        {eventoForm.opcoes_precos && eventoForm.opcoes_precos.length > 0 ? (
                          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                            {eventoForm.opcoes_precos.map((opt, idx) => (
                              <div key={idx} className="flex justify-between items-center px-4 py-2.5 text-xs text-slate-700">
                                <span>{opt.nome}</span>
                                <div className="flex items-center gap-3">
                                  <span className="font-bold">{formatCurrency(opt.preco)}</span>
                                  <button type="button" onClick={() => removePriceOption(idx)} className="text-red-500 hover:text-red-700">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">Nenhuma categoria de preço adicionada.</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                    <h4 className="font-bold text-slate-800 text-sm">Modalidades / Categorias de Inscrição</h4>
                    <p className="text-xs text-slate-400">Insira as categorias disponíveis para escolha na inscrição (ex: Sub-7, Sub-9, Livre, Categoria A, etc.).</p>
                    
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Nome da categoria (Ex: Sub-9 Feminino)" 
                        value={newCategoryName} 
                        onChange={e => setNewCategoryName(e.target.value)} 
                        className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800" 
                      />
                      <button 
                        type="button" 
                        onClick={addCategoryTag} 
                        className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
                      >
                        Adicionar Categoria
                      </button>
                    </div>

                    {eventoForm.categorias_inscricao && eventoForm.categorias_inscricao.length > 0 ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {eventoForm.categorias_inscricao.map((cat, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {cat}
                            <button type="button" onClick={() => removeCategoryTag(idx)} className="text-indigo-500 hover:text-indigo-700 ml-1">
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">Nenhuma modalidade adicionada.</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="apenas_alunos" 
                      checked={eventoForm.apenas_alunos || false} 
                      onChange={e => setEventoForm({ ...eventoForm, apenas_alunos: e.target.checked })} 
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300" 
                    />
                    <label htmlFor="apenas_alunos" className="text-xs font-bold text-slate-600 cursor-pointer">Permitir inscrições apenas de alunos ativos cadastrados no portal</label>
                  </div>

                  {/* Formulário básico de coleta */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-3">
                    <h4 className="font-bold text-slate-800 text-sm">📋 Formulário Básico de Coleta</h4>
                    <p className="text-xs text-slate-500">Estes campos são coletados de <strong>todos os inscritos</strong> automaticamente, independente do evento:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Nome do Aluno', obrigatorio: true },
                        { label: 'Data de Nascimento', obrigatorio: true },
                        { label: 'Nome do Responsável', obrigatorio: true },
                        { label: 'E-mail do Responsável', obrigatorio: true },
                        { label: 'WhatsApp do Responsável', obrigatorio: true },
                        { label: 'Categoria de Inscrição', obrigatorio: eventoForm.categorias_inscricao && (eventoForm.categorias_inscricao as string[]).length > 0 },
                      ].map((field, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-600">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${field.obrigatorio ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                          <span>{field.label}</span>
                          {field.obrigatorio && <span className="ml-auto text-[10px] font-bold text-emerald-600 uppercase">Obrigatório</span>}
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-400 italic">🟢 Verde = Obrigatório &nbsp;|&nbsp; ⚪ Cinza = Opcional</p>
                  </div>

                  {/* Campos personalizados adicionais */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">🔧 Campos de Informação Adicional</h4>
                      <p className="text-xs text-slate-400 mt-1">Adicione perguntas extras que serão exibidas no formulário de inscrição deste evento (ex: Tamanho da camiseta, Faixa de graduação, Clube de origem…).</p>
                    </div>

                    {/* Linha de adição */}
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-4">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Rótulo do Campo</label>
                        <input
                          type="text"
                          placeholder="Ex: Tamanho da Camiseta"
                          value={newFieldLabel}
                          onChange={e => setNewFieldLabel(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo</label>
                        <select
                          value={newFieldTipo}
                          onChange={e => setNewFieldTipo(e.target.value as any)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800"
                        >
                          <option value="texto">Texto Curto</option>
                          <option value="textarea">Texto Longo</option>
                          <option value="numero">Número</option>
                          <option value="select">Seleção (lista)</option>
                          <option value="data">Data</option>
                        </select>
                      </div>
                      {newFieldTipo === 'select' && (
                        <div className="col-span-3">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Opções (separadas por vírgula)</label>
                          <input
                            type="text"
                            placeholder="P, M, G, GG"
                            value={newFieldOpcoes}
                            onChange={e => setNewFieldOpcoes(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800"
                          />
                        </div>
                      )}
                      <div className="col-span-2 flex items-center gap-1.5 pb-1">
                        <input
                          type="checkbox"
                          id="new_field_obrig"
                          checked={newFieldObrigatorio}
                          onChange={e => setNewFieldObrigatorio(e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-300"
                        />
                        <label htmlFor="new_field_obrig" className="text-[10px] font-bold text-slate-500 uppercase cursor-pointer">Obrigatório</label>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            if (!newFieldLabel.trim()) return;
                            const campo = {
                              label: newFieldLabel.trim(),
                              tipo: newFieldTipo,
                              obrigatorio: newFieldObrigatorio,
                              ...(newFieldTipo === 'select' ? { opcoes: newFieldOpcoes.split(',').map(o => o.trim()).filter(Boolean) } : {})
                            };
                            setEventoForm({
                              ...eventoForm,
                              campos_personalizados: [...(eventoForm.campos_personalizados as any[] || []), campo]
                            });
                            setNewFieldLabel('');
                            setNewFieldTipo('texto');
                            setNewFieldOpcoes('');
                            setNewFieldObrigatorio(false);
                          }}
                          className="w-full px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 whitespace-nowrap"
                        >
                          + Add
                        </button>
                      </div>
                    </div>

                    {/* Lista de campos adicionados */}
                    {(eventoForm.campos_personalizados as any[] || []).length > 0 ? (
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                        <div className="flex items-center px-4 py-2 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <span className="flex-1">Rótulo</span>
                          <span className="w-24 text-center">Tipo</span>
                          <span className="w-32 text-center">Opções / Detalhe</span>
                          <span className="w-24 text-center">Obrigatório</span>
                          <span className="w-10"></span>
                        </div>
                        {(eventoForm.campos_personalizados as any[] || []).map((campo, idx) => (
                          <div key={idx} className="flex items-center px-4 py-3 text-xs text-slate-700">
                            <span className="flex-1 font-bold">{campo.label}</span>
                            <span className="w-24 text-center text-slate-400">
                              {{ texto: 'Texto', textarea: 'Texto Longo', numero: 'Número', select: 'Seleção', data: 'Data' }[campo.tipo as string] || campo.tipo}
                            </span>
                            <span className="w-32 text-center text-slate-400 text-[11px] truncate px-1">
                              {campo.opcoes?.join(', ') || '—'}
                            </span>
                            <span className="w-24 text-center">
                              {campo.obrigatorio
                                ? <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Sim</span>
                                : <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Não</span>
                              }
                            </span>
                            <div className="w-10 flex justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  const list = (eventoForm.campos_personalizados as any[]) || [];
                                  setEventoForm({ ...eventoForm, campos_personalizados: list.filter((_, i) => i !== idx) });
                                }}
                                className="text-red-400 hover:text-red-600"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic text-center py-2">Nenhum campo adicional configurado. Use o formulário acima para adicionar.</p>
                    )}
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
                form="event-edit-form"
                disabled={loadingAction}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm flex items-center gap-2"
              >
                {loadingAction ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check className="w-5 h-5" />
                )}
                {selectedId ? 'Salvar Alterações' : 'Criar Evento'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      
      {/* MAIN CONTENT */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Cursos e Eventos</h2>
        <button
          onClick={() => {
            setSelectedId(null);
            setEventoForm({
              titulo: '', slug: '', descricao: '', data_inicio: '', data_fim: '', prazo_inscricao: '',
              vagas_total: null, taxa_inscricao: 0, gratuito: false, status: 'ativo', local: '',
              unidade_nome: '', categorias_inscricao: [], apenas_alunos: false,
              tipo_preco: 'fixo', opcoes_precos: [], campos_personalizados: [], tipo: 'evento'
            });
            setIsEditing(true);
          }}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Novo Evento/Curso
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="p-4 text-xs font-bold text-slate-500 uppercase">Título</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase">Tipo</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase">Data Início</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase">Status</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase text-center w-24">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {eventos.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500 text-sm">
                  Nenhum evento ou curso cadastrado.
                </td>
              </tr>
            ) : (
              eventos.map((evento) => (
                <tr key={evento.id} className="hover:bg-slate-50">
                  <td className="p-4">
                    <p className="text-sm font-bold text-slate-800">{evento.titulo}</p>
                  </td>
                  <td className="p-4">
                    <span className="text-sm font-medium text-slate-600 capitalize">{evento.tipo}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm font-medium text-slate-600">
                      {new Date(evento.data_inicio).toLocaleDateString('pt-BR')}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      evento.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' : 
                      evento.status === 'encerrado' ? 'bg-slate-100 text-slate-700' : 
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {evento.status}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleEditEvento(evento)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteEvento(evento.id)}
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
