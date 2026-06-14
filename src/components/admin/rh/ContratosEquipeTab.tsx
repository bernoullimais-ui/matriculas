import React, { useState, useEffect } from 'react';
import { Users, Loader, Edit2, Save, X, DollarSign, Percent, Calculator } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ContratosEquipeTab() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [tipoContrato, setTipoContrato] = useState('CLT_HORISTA');
  const [valorHoraAula, setValorHoraAula] = useState('');
  const [percentualRepasse, setPercentualRepasse] = useState('');
  const [aplicaVt, setAplicaVt] = useState(false);
  const [custoMensalVt, setCustoMensalVt] = useState('');
  const [salarioBase, setSalarioBase] = useState('');

  useEffect(() => {
    loadUsuarios();
  }, []);

  const loadUsuarios = async () => {
    setLoading(true);
    try {
      const headers = {
        'Authorization': `Bearer ${sessionStorage.getItem('admin_token')}`
      };
      const res = await fetch('/api/admin/rh/contratos', { headers });
      if (res.ok) {
        const data = await res.json();
        setUsuarios(data);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Erro ao carregar equipe');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro de conexão');
    }
    setLoading(false);
  };

  const handleEditClick = (user: any) => {
    setEditingUser(user);
    if (user.config) {
      setTipoContrato(user.config.tipo_contrato || 'CLT_HORISTA');
      setValorHoraAula(user.config.valor_hora_aula?.toString() || '');
      setPercentualRepasse(user.config.percentual_repasse_padrao?.toString() || '');
      setAplicaVt(user.config.aplica_vt || false);
      setCustoMensalVt(user.config.custo_mensal_vt?.toString() || '');
      setSalarioBase(user.config.salario_base?.toString() || '');
    } else {
      setTipoContrato('CLT_HORISTA');
      setValorHoraAula('');
      setPercentualRepasse('');
      setAplicaVt(false);
      setCustoMensalVt('');
      setSalarioBase('');
    }
  };

  const handleSave = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      const payload = {
        tipo_contrato: tipoContrato,
        valor_hora_aula: valorHoraAula ? parseFloat(valorHoraAula) : null,
        percentual_repasse_padrao: percentualRepasse ? parseFloat(percentualRepasse) : null,
        aplica_vt: aplicaVt,
        custo_mensal_vt: custoMensalVt ? parseFloat(custoMensalVt) : null,
        salario_base: salarioBase ? parseFloat(salarioBase) : null,
      };

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('admin_token')}`
      };

      const res = await fetch(`/api/admin/rh/contratos/${editingUser.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success('Contrato atualizado!');
        loadUsuarios();
        setEditingUser(null);
      } else {
        toast.error('Erro ao salvar');
      }
    } catch (e) {
      toast.error('Erro de conexão');
    }
    setSaving(false);
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="text-indigo-600" /> Equipe e Contratos
          </h2>
          <p className="text-slate-500 text-sm">Configure as regras de remuneração de cada colaborador.</p>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader className="animate-spin text-indigo-600" size={32} />
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-100 text-xs uppercase font-bold text-slate-500">
                <tr>
                  <th className="px-6 py-4">Colaborador</th>
                  <th className="px-6 py-4">Nível</th>
                  <th className="px-6 py-4">Regime</th>
                  <th className="px-6 py-4">Status VT</th>
                  <th className="px-6 py-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usuarios.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">{u.nome}</td>
                    <td className="px-6 py-4">
                      <span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md text-xs font-bold">{u.nivel || 'Membro'}</span>
                    </td>
                    <td className="px-6 py-4">
                      {u.config ? (
                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                          u.config.tipo_contrato === 'PJ_REPASSE' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {u.config.tipo_contrato.replace('_', ' ')}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Não configurado</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {u.config?.aplica_vt ? (
                        <span className="text-emerald-600 font-bold text-xs">Ativo</span>
                      ) : (
                        <span className="text-slate-400 text-xs">Inativo</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleEditClick(u)}
                        className="p-2 bg-slate-100 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                      >
                        <Edit2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL EDIÇÃO */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-3xl">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Regras de Contrato</h3>
                <p className="text-slate-500 text-sm">Configurando: <strong className="text-indigo-600">{editingUser.nome}</strong></p>
              </div>
              <button onClick={() => setEditingUser(null)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Regime de Contratação</label>
                <select 
                  value={tipoContrato}
                  onChange={(e) => setTipoContrato(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                >
                  <option value="CLT_HORISTA">CLT Horista</option>
                  <option value="CLT_INTERMITENTE">CLT Intermitente</option>
                  <option value="PJ_REPASSE">PJ (Repasse)</option>
                  <option value="FIXO">Salário Fixo</option>
                </select>
              </div>

              {tipoContrato === 'CLT_HORISTA' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><DollarSign size={14}/> Valor Hora/Aula (R$)</label>
                  <input 
                    type="number" step="0.01" value={valorHoraAula} onChange={e => setValorHoraAula(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Ex: 45.50"
                  />
                  <p className="text-[11px] text-slate-400">O DSR será calculado automaticamente sobre este valor.</p>
                </div>
              )}

              {tipoContrato === 'PJ_REPASSE' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Percent size={14}/> % de Repasse Padrão</label>
                  <input 
                    type="number" step="0.1" value={percentualRepasse} onChange={e => setPercentualRepasse(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Ex: 30.0"
                  />
                  <p className="text-[11px] text-slate-400">Pode ser sobrescrito por repasses específicos de cada turma.</p>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center gap-3 mb-4">
                  <input 
                    type="checkbox" 
                    id="aplicaVt" 
                    checked={aplicaVt} 
                    onChange={e => setAplicaVt(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="aplicaVt" className="text-sm font-bold text-slate-700 cursor-pointer">
                    Aplica regra de Vale-Transporte (Teto 6%)
                  </label>
                </div>
                
                {aplicaVt && (
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase">Salário Base (R$)</label>
                      <input 
                        type="number" step="0.01" value={salarioBase} onChange={e => setSalarioBase(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="Ex: 1500.00"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase">Custo Real Mensal do VT (R$)</label>
                      <input 
                        type="number" step="0.01" value={custoMensalVt} onChange={e => setCustoMensalVt(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="Ex: 250.00"
                      />
                    </div>
                    <div className="col-span-2 pt-2">
                      <p className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Calculator size={12} className="text-indigo-500"/> 
                        O sistema calculará 6% do Salário Base. Se o custo real for maior, desconta os 6% e lança o restante como benefício. Se for menor, não desconta nada.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex gap-3 justify-end rounded-b-3xl bg-slate-50/50">
              <button 
                onClick={() => setEditingUser(null)}
                className="px-6 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-200 transition-all disabled:opacity-50"
              >
                {saving ? <Loader className="animate-spin" size={18} /> : <Save size={18} />}
                Salvar Regras
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
