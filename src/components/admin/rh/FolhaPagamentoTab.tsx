import React, { useState, useEffect } from 'react';
import { DollarSign, Loader, Play, CheckCircle2, Search, Calendar, FileText, Download } from 'lucide-react';
import toast from 'react-hot-toast';

export default function FolhaPagamentoTab() {
  const [loading, setLoading] = useState(false);
  const [folhas, setFolhas] = useState<any[]>([]);
  const [mesReferencia, setMesReferencia] = useState('');

  useEffect(() => {
    // Set default month to current
    const date = new Date();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    setMesReferencia(`${y}-${m}-01`);
  }, []);

  const handleCalculate = async () => {
    setLoading(true);
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('admin_token')}`
      };
      
      const res = await fetch('/api/admin/payroll/calculate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ mes_referencia: mesReferencia })
      });
      
      const data = await res.json();
      if (res.ok) {
        toast.success('Rascunho da folha gerado com sucesso!');
        setFolhas(data.folhas || []);
      } else {
        toast.error(data.error || 'Erro ao calcular folha');
      }
    } catch (e) {
      toast.error('Erro de conexão');
    }
    setLoading(false);
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <DollarSign className="text-indigo-600" /> Fechamento de Folha
          </h2>
          <p className="text-slate-500 text-sm">Gere os cálculos de remuneração para a equipe.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="date" 
              value={mesReferencia}
              onChange={(e) => setMesReferencia(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <button 
            onClick={handleCalculate}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-200 transition-all disabled:opacity-50"
          >
            {loading ? <Loader className="animate-spin" size={16} /> : <Play size={16} />}
            Calcular Mês
          </button>
        </div>
      </div>

      {!folhas || folhas.length === 0 ? (
        <div className="bg-slate-50 border border-slate-100 rounded-3xl p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
            <FileText className="text-slate-300" size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">Nenhuma folha gerada para este mês</h3>
          <p className="text-slate-500 text-sm max-w-md">Selecione o mês desejado e clique em "Calcular Mês" para processar DSR, repasses PJ, hora-aula e Vale-Transporte.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {folhas.map((f, i) => (
            <div key={i} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-1 h-full ${f.status === 'FECHADO' ? 'bg-emerald-500' : 'bg-amber-400'}`}></div>
              
              <div className="flex justify-between items-start mb-4 pl-2">
                <div>
                  <h3 className="font-bold text-slate-800">{f.usuario?.nome || 'Colaborador'}</h3>
                  <span className="text-xs text-slate-500">{f.config?.tipo_contrato?.replace('_', ' ')}</span>
                </div>
                {f.status === 'FECHADO' ? (
                  <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md text-[10px] font-bold uppercase flex items-center gap-1">
                    <CheckCircle2 size={12}/> Fechado
                  </span>
                ) : (
                  <span className="bg-amber-50 text-amber-600 px-2 py-1 rounded-md text-[10px] font-bold uppercase">
                    Em Análise
                  </span>
                )}
              </div>

              <div className="space-y-3 mb-6 flex-1 pl-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Valor Bruto</span>
                  <span className="font-medium text-slate-700">R$ {parseFloat(f.valor_bruto || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 text-rose-500">Descontos (VT)</span>
                  <span className="font-medium text-rose-600">- R$ {parseFloat(f.valor_descontos || 0).toFixed(2)}</span>
                </div>
                <div className="pt-3 mt-3 border-t border-slate-100 flex justify-between items-center">
                  <span className="font-bold text-slate-800">Líquido a Pagar</span>
                  <span className="text-xl font-extrabold text-indigo-600">R$ {parseFloat(f.valor_liquido || 0).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-2 pl-2">
                <button className="flex-1 flex justify-center items-center gap-2 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-colors">
                  <Search size={14} /> Detalhes
                </button>
                {f.status !== 'FECHADO' && (
                  <button className="flex-1 flex justify-center items-center gap-2 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-bold transition-colors">
                    <CheckCircle2 size={14} /> Fechar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
