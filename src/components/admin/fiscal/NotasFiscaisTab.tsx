import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Search, FileText, AlertCircle, CheckCircle2, Clock, Download } from 'lucide-react';
import toast from 'react-hot-toast';

export default function NotasFiscaisTab() {
  const [notas, setNotas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchNotas();
  }, []);

  const fetchNotas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notas_fiscais_fila')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setNotas(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao buscar notas fiscais');
    } finally {
      setLoading(false);
    }
  };

  const filteredNotas = notas.filter(nota => {
    const term = search.toLowerCase();
    const pagId = nota.pagamento_id?.toLowerCase() || '';
    const nome = nota.dados_emissao?.nome?.toLowerCase() || '';
    const cpf = nota.dados_emissao?.cpf?.toLowerCase() || '';
    return pagId.includes(term) || nome.includes(term) || cpf.includes(term);
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'autorizado':
        return <span className="flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold"><CheckCircle2 size={14} /> Autorizada</span>;
      case 'erro':
        return <span className="flex items-center gap-1 px-2 py-1 bg-rose-100 text-rose-700 rounded-lg text-xs font-bold"><AlertCircle size={14} /> Erro</span>;
      case 'processando':
        return <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold"><Clock size={14} /> Processando</span>;
      default:
        return <span className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold"><Clock size={14} /> Pendente</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Notas Fiscais</h2>
          <p className="text-slate-500">Acompanhe a emissão de notas de serviço e produtos.</p>
        </div>
        
        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Buscar por nome, CPF ou ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-bold">Data</th>
                <th className="px-6 py-4 font-bold">Cliente</th>
                <th className="px-6 py-4 font-bold">Tipo</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    Carregando notas fiscais...
                  </td>
                </tr>
              ) : filteredNotas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    Nenhuma nota fiscal encontrada.
                  </td>
                </tr>
              ) : (
                filteredNotas.map((nota) => (
                  <tr key={nota.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                      {new Date(nota.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{nota.dados_emissao?.nome || 'Não informado'}</div>
                      <div className="text-xs text-slate-500">CPF: {nota.dados_emissao?.cpf || 'Não informado'}</div>
                      <div className="text-xs text-slate-400">ID Pag: {nota.pagamento_id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-bold uppercase">
                        {nota.tipo_nota}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(nota.status)}
                      {nota.mensagem_erro && (
                        <div className="text-[10px] text-rose-500 mt-1 max-w-[200px] truncate" title={nota.mensagem_erro}>
                          {nota.mensagem_erro}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {nota.nfe_url_pdf && (
                          <a href={nota.nfe_url_pdf} target="_blank" rel="noreferrer" className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Baixar PDF">
                            <FileText size={18} />
                          </a>
                        )}
                        {nota.nfe_url_xml && (
                          <a href={nota.nfe_url_xml} target="_blank" rel="noreferrer" className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Baixar XML">
                            <Download size={18} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
