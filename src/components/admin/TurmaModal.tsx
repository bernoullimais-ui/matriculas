import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface TurmaModalProps {
  isOpen: boolean;
  onClose: () => void;
  turma: any | null; // null means 'create'
  onSave: (data: any) => Promise<void>;
  options: {
    unidades: any[];
    series: string[];
    professores: any[];
  };
}

export default function TurmaModal({ isOpen, onClose, turma, onSave, options }: TurmaModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<any>({
    nome: '',
    professor: '',
    professor_id: '',
    dias_horarios: '',
    capacidade: 0,
    valor_mensalidade: 0,
    local_aula: '',
    data_inicio: '',
    idade_minima: 0,
    idade_maxima: 18,
    unidades_selecionadas: [] as string[],
    series_permitidas: [] as string[],
    status: 'ativo'
  });

  const [isUnidadeDropdownOpen, setIsUnidadeDropdownOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (turma) {
        // Edit mode
        setFormData({
          nome: turma.nome || '',
          professor: turma.professor || '',
          professor_id: turma.professor_id || '',
          dias_horarios: turma.dias_horarios || '',
          capacidade: turma.capacidade || 0,
          valor_mensalidade: turma.valor_mensalidade || 0,
          local_aula: turma.local_aula || '',
          data_inicio: turma.data_inicio || '',
          idade_minima: turma.idade_minima || 0,
          idade_maxima: turma.idade_maxima || 18,
          unidades_selecionadas: turma.unidades_selecionadas || (turma.unidade_nome ? [turma.unidade_nome] : []),
          series_permitidas: turma.series_permitidas || [],
          status: turma.status || 'ativo'
        });
      } else {
        // Create mode
        setFormData({
          nome: '',
          professor: '',
          professor_id: '',
          dias_horarios: '',
          capacidade: 0,
          valor_mensalidade: 0,
          local_aula: '',
          data_inicio: '',
          idade_minima: 0,
          idade_maxima: 18,
          unidades_selecionadas: [],
          series_permitidas: [],
          status: 'ativo'
        });
      }
      setIsUnidadeDropdownOpen(false);
    }
  }, [isOpen, turma]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome) {
      toast.error('O nome do curso é obrigatório.');
      return;
    }
    if (formData.unidades_selecionadas.length === 0) {
      toast.error('Selecione pelo menos uma unidade.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving turma:', error);
      toast.error('Erro ao salvar turma.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleUnidade = (uName: string) => {
    setFormData((prev: any) => {
      const selected = prev.unidades_selecionadas || [];
      if (selected.includes(uName)) {
        return { ...prev, unidades_selecionadas: selected.filter((name: string) => name !== uName) };
      } else {
        return { ...prev, unidades_selecionadas: [...selected, uName] };
      }
    });
  };

  const handleToggleSerie = (sName: string) => {
    setFormData((prev: any) => {
      const selected = prev.series_permitidas || [];
      if (selected.includes(sName)) {
        return { ...prev, series_permitidas: selected.filter((name: string) => name !== sName) };
      } else {
        return { ...prev, series_permitidas: [...selected, sName] };
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center z-50 p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-full">
        {/* Header */}
        <div className="bg-blue-600 px-6 py-5 flex items-start justify-between shrink-0">
          <div>
            <h2 className="text-white text-2xl font-black tracking-tight uppercase">
              {turma ? 'EDITAR DADOS DA TURMA' : 'CRIAR NOVA TURMA'}
            </h2>
            <p className="text-blue-100 text-xs mt-1 font-medium uppercase tracking-wider">
              {turma ? `ID: ${turma.id || 'N/A'}` : 'PREENCHA OS DADOS BÁSICOS DO CURSO'}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-blue-500/50 hover:bg-blue-500 text-white rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50">
          <form id="turma-form" onSubmit={handleSubmit} className="space-y-6">
            
            {turma && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status da Turma</label>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, status: formData.status === 'ativo' ? 'inativo' : 'ativo' })}
                  className={`w-full py-3 rounded-xl font-bold text-sm uppercase transition-all border flex items-center justify-center gap-2 ${
                    formData.status === 'ativo' 
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' 
                      : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${formData.status === 'ativo' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                  {formData.status === 'ativo' ? 'Turma Ativa' : 'Turma Inativa'}
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nome do Curso / Turma <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formData.nome}
                    onChange={e => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Robótica Kids"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800 placeholder-slate-300"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Professor(a)</label>
                  <select
                    value={formData.professor}
                    onChange={e => {
                      const prof = options.professores.find((p: any) => p.nome === e.target.value);
                      setFormData({ 
                        ...formData, 
                        professor: e.target.value,
                        professor_id: prof ? prof.id : ''
                      });
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
                  >
                    <option value="">Selecione o Professor</option>
                    {options.professores.map((p: any) => (
                      <option key={p.id} value={p.nome}>{p.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dias e Horários</label>
                  <input
                    type="text"
                    value={formData.dias_horarios}
                    onChange={e => setFormData({ ...formData, dias_horarios: e.target.value })}
                    placeholder="Ex: Seg e Qua - 14:00 às 15:30"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800 placeholder-slate-300"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Capacidade (Vagas)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.capacidade || ''}
                      onChange={e => setFormData({ ...formData, capacidade: Number(e.target.value) })}
                      placeholder="0"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800 placeholder-slate-300"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Valor Mensal (R$)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.valor_mensalidade || ''}
                      onChange={e => setFormData({ ...formData, valor_mensalidade: Number(e.target.value) })}
                      placeholder="0.00"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800 placeholder-slate-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Local da Aula</label>
                    <input
                      type="text"
                      value={formData.local_aula}
                      onChange={e => setFormData({ ...formData, local_aula: e.target.value })}
                      placeholder="Ex: Sala 01, Quadra"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800 placeholder-slate-300"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Data de Início</label>
                    <input
                      type="date"
                      value={formData.data_inicio}
                      onChange={e => setFormData({ ...formData, data_inicio: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-5">
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Unidade <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <div 
                      className="min-h-[46px] w-full px-4 py-2 rounded-xl border border-slate-200 bg-white cursor-pointer flex flex-wrap gap-2 items-center"
                      onClick={() => setIsUnidadeDropdownOpen(!isUnidadeDropdownOpen)}
                    >
                      {formData.unidades_selecionadas.length === 0 && (
                        <span className="text-slate-400 text-sm font-medium">Selecione a Unidade</span>
                      )}
                      {formData.unidades_selecionadas.map((unidade: string) => (
                        <div key={unidade} className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200">
                          {unidade}
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleUnidade(unidade);
                            }}
                            className="hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-md p-0.5 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    {isUnidadeDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsUnidadeDropdownOpen(false)} />
                        <div className="absolute z-20 top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto p-2">
                          {options.unidades.map((u: any) => {
                            const unitName = typeof u === 'object' ? u.nome : u;
                            const isChecked = formData.unidades_selecionadas.includes(unitName);
                            return (
                              <div 
                                key={unitName}
                                className="flex items-center p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors group"
                                onClick={() => handleToggleUnidade(unitName)}
                              >
                                <div className={`w-4 h-4 rounded border mr-3 flex items-center justify-center ${isChecked ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                                  {isChecked && <Check size={12} className="text-white" />}
                                </div>
                                <span className="text-sm font-semibold text-slate-700 group-hover:text-blue-700 transition-colors">
                                  {unitName}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Idade Mínima</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.idade_minima || ''}
                      onChange={e => setFormData({ ...formData, idade_minima: Number(e.target.value) })}
                      placeholder="0"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800 placeholder-slate-300"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Idade Máxima</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.idade_maxima || ''}
                      onChange={e => setFormData({ ...formData, idade_maxima: Number(e.target.value) })}
                      placeholder="18"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800 placeholder-slate-300"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Séries Permitidas</label>
                  <div className="bg-white rounded-xl border border-slate-200 p-4 max-h-[200px] overflow-y-auto custom-scrollbar">
                    <div className="flex flex-wrap gap-2">
                      {options.series.map((serie: string) => {
                        const isSelected = formData.series_permitidas.includes(serie);
                        return (
                          <button
                            key={serie}
                            type="button"
                            onClick={() => handleToggleSerie(serie)}
                            className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all flex-grow sm:flex-grow-0 text-center ${
                              isSelected 
                                ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm' 
                                : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50'
                            }`}
                          >
                            {serie}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 bg-white border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors uppercase tracking-wide"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="turma-form"
            disabled={isSubmitting}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-black rounded-xl transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
          >
            {isSubmitting ? 'Salvando...' : (turma ? 'Salvar Alterações' : 'Criar Turma')}
          </button>
        </div>
      </div>
    </div>
  );
}
