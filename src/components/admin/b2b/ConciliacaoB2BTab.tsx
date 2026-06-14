import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calculator, CheckCircle2, ChevronDown, ChevronUp, DollarSign, Download, Play, Search, AlertCircle, Building2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ConciliacaoB2BTabProps {
  unidadesComp?: any[];
}

export const ConciliacaoB2BTab: React.FC<ConciliacaoB2BTabProps> = ({ unidadesComp }) => {
  const [mesReferencia, setMesReferencia] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/admin/b2b/history', {
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('admin_token')}` }
      });
      if (res.ok) {
        setHistory(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleCalculate = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/b2b/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('admin_token')}`
        },
        body: JSON.stringify({ mes_referencia: mesReferencia })
      });

      if (res.ok) {
        const data = await res.json();
        setResults(data.resultados || []);
        toast.success('Conciliação calculada!');
      } else {
        toast.error('Erro ao calcular conciliação');
      }
    } catch (e) {
      toast.error('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseMonth = async () => {
    if (!results.length) return;
    try {
      setLoading(true);
      const res = await fetch('/api/admin/b2b/close', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('admin_token')}`
        },
        body: JSON.stringify({ resultados: results })
      });

      if (res.ok) {
        toast.success('Mês fechado com sucesso!');
        setResults([]);
        loadHistory();
      } else {
        toast.error('Erro ao fechar mês');
      }
    } catch (e) {
      toast.error('Erro ao fechar mês');
    } finally {
      setLoading(false);
    }
  };

  // Mesclar resultados em tela com os do historico
  const closedForMonth = history.filter(h => h.mes_referencia.startsWith(mesReferencia.substring(0, 7)));
  const displayItems = results.length > 0 ? results : closedForMonth;
  const isClosed = results.length === 0 && closedForMonth.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Calculator className="text-indigo-600" />
            Conciliação Financeira B2B
          </h2>
          <p className="text-slate-500 text-sm mt-1">Calcule o repasse para as Escolas Parceiras no mês de referência.</p>
        </div>

        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mês de Referência</label>
            <input
              type="date"
              value={mesReferencia}
              onChange={(e) => {
                setMesReferencia(e.target.value);
                setResults([]);
              }}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-medium text-slate-700 shadow-sm"
            />
          </div>

          <button
            onClick={handleCalculate}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-sm flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Calculator className="w-5 h-5 animate-spin" /> : <Play size={18} />}
            Calcular Repasses
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {displayItems.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300">
              <Building2 size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Nenhum cálculo efetuado</h3>
            <p className="text-slate-500 max-w-md">
              Selecione o mês de referência e clique em "Calcular Repasses" para extrair os pagamentos vinculados a cada escola.
            </p>
          </div>
        ) : (
          <div>
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                {isClosed ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 size={16} /> Mês Fechado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    <AlertCircle size={16} /> Em Análise (Aberto)
                  </span>
                )}
                <span className="text-sm text-slate-500 font-medium">{displayItems.length} Escolas calculadas</span>
              </div>
              
              {!isClosed && (
                <button
                  onClick={handleCloseMonth}
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm flex items-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  Cravar Conciliação B2B
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-100">
              {displayItems.map((item, idx) => {
                const uNome = item.unidade?.nome || item.unidades?.nome || 'Desconhecido';
                const isExpanded = expandedRow === uNome;
                
                return (
                  <div key={idx} className="bg-white">
                    <div 
                      className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => setExpandedRow(isExpanded ? null : uNome)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                          {uNome.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800">{uNome}</h4>
                          <div className="text-sm text-slate-500">
                            Arrecadado: R$ {Number(item.valor_arrecadado).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-8">
                        <div className="text-right">
                          <div className="text-xs font-semibold text-slate-500 uppercase">Valor Repasse</div>
                          <div className="font-mono font-bold text-lg text-emerald-600">
                            R$ {Number(item.valor_repasse).toFixed(2)}
                          </div>
                        </div>
                        <div className="text-slate-400">
                          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-5 pb-5 pt-2 bg-slate-50/50 border-t border-slate-100">
                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                          <h5 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider">Detalhamento do Cálculo</h5>
                          <ul className="space-y-2 font-mono text-sm">
                            {Array.isArray(item.json_detalhamento) ? (
                              item.json_detalhamento.map((det: string, i: number) => (
                                <li key={i} className="flex gap-2 text-slate-600">
                                  <span className="text-indigo-400">›</span> {det}
                                </li>
                              ))
                            ) : (
                              <li className="text-slate-500 italic">Sem detalhamento salvo.</li>
                            )}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
