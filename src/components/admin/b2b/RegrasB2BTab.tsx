import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Plus, X, Building2, Percent, DollarSign, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ConfigUnidade {
  unidade: {
    id: string;
    nome: string;
  };
  config: {
    tipo_repasse: string;
    percentual_repasse: number;
  } | null;
}

export const RegrasB2BTab = () => {
  const [unidades, setUnidades] = useState<ConfigUnidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingUnidade, setEditingUnidade] = useState<ConfigUnidade | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/b2b/config', {
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('admin_token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUnidades(data);
      }
    } catch (e) {
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUnidade) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/admin/b2b/config/${editingUnidade.unidade.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('admin_token')}`
        },
        body: JSON.stringify({
          tipo_repasse: editingUnidade.config?.tipo_repasse || 'SEDE_PARA_UNIDADE',
          percentual_repasse: editingUnidade.config?.percentual_repasse || 0
        })
      });
      
      if (res.ok) {
        toast.success('Regra salva com sucesso!');
        setEditingUnidade(null);
        fetchConfig();
      } else {
        toast.error('Erro ao salvar regra');
      }
    } catch (e) {
      toast.error('Erro ao salvar regra');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="text-indigo-600" />
            Regras de Repasse B2B
          </h2>
          <p className="text-slate-500 text-sm mt-1">Configure o percentual e a direção do repasse para cada Escola Parceira.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-sm">
                <th className="py-4 px-6 font-semibold text-slate-700">Unidade Escolar</th>
                <th className="py-4 px-6 font-semibold text-slate-700">Direção do Fluxo (Arrecadação)</th>
                <th className="py-4 px-6 font-semibold text-slate-700">Percentual do Repasse</th>
                <th className="py-4 px-6 font-semibold text-slate-700 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {unidades.map((item) => (
                <tr key={item.unidade.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-6 font-medium text-slate-800">
                    {item.unidade.nome}
                  </td>
                  <td className="py-4 px-6 text-slate-600">
                    {!item.config ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                        Não Configurado
                      </span>
                    ) : item.config.tipo_repasse === 'SEDE_PARA_UNIDADE' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        SFK Paga Escola
                      </span>
                    ) : item.config.tipo_repasse === 'UNIDADE_PARA_SEDE' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        Escola Paga SFK
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                        Integral
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6 font-mono text-slate-700">
                    {item.config ? `${item.config.percentual_repasse}%` : '-'}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={() => setEditingUnidade({
                        unidade: item.unidade,
                        config: item.config || { tipo_repasse: 'SEDE_PARA_UNIDADE', percentual_repasse: 0 }
                      })}
                      className="text-indigo-600 hover:text-indigo-800 font-medium text-sm transition-colors"
                    >
                      Configurar
                    </button>
                  </td>
                </tr>
              ))}
              {unidades.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    Nenhuma unidade cadastrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Edição */}
      {editingUnidade && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800">Regras B2B: {editingUnidade.unidade.nome}</h3>
              <button
                onClick={() => setEditingUnidade(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Quem arrecada e quem repassa?</label>
                <select
                  value={editingUnidade.config?.tipo_repasse || 'SEDE_PARA_UNIDADE'}
                  onChange={(e) => setEditingUnidade({
                    ...editingUnidade,
                    config: { ...editingUnidade.config!, tipo_repasse: e.target.value }
                  })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-slate-700"
                >
                  <option value="SEDE_PARA_UNIDADE">SFK cobra clientes e repassa % para Escola</option>
                  <option value="UNIDADE_PARA_SEDE">Escola cobra clientes e repassa % para SFK</option>
                  <option value="B2B_INTEGRAL">B2B Integral (Não repassa valores picados)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                  Percentual do Repasse <Percent size={14} className="text-slate-400"/>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={editingUnidade.config?.percentual_repasse || 0}
                    onChange={(e) => setEditingUnidade({
                      ...editingUnidade,
                      config: { ...editingUnidade.config!, percentual_repasse: parseFloat(e.target.value) }
                    })}
                    className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    placeholder="0.00"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400 font-medium">
                    %
                  </div>
                </div>
                <p className="text-xs text-slate-500">Ex: 20% do valor da mensalidade paga pelo aluno irá para o destino do repasse.</p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Save size={18} />
                  )}
                  Salvar Regra
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};
