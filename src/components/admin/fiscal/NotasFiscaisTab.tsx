import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Search, FileText, AlertCircle, CheckCircle2, Clock, Download, Send } from 'lucide-react';
import toast from 'react-hot-toast';

export default function NotasFiscaisTab() {
  const [notas, setNotas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

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

  const handleReenviar = async (id: string) => {
    try {
      setProcessingId(id);
      const toastId = toast.loading('Processando nota fiscal...');
      
      const response = await fetch(`/api/admin/notas/reenviar/${id}`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Falha ao processar a nota fiscal.');
      }
      
      const result = await response.json();
      if (result.success) {
        toast.success('Nota fiscal enviada com sucesso!', { id: toastId });
      } else {
        toast.error(`Erro: ${result.error || 'Falha ao autorizar nota'}`, { id: toastId });
      }
      
      await fetchNotas();
    } catch (err) {
      console.error(err);
      toast.error('Erro de comunicação ao reenviar nota fiscal.');
    } finally {
      setProcessingId(null);
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
    switch (status?.toLowerCase()) {
      case 'autorizado':
        return <span className="flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold"><CheckCircle2 size={14} /> Autorizada</span>;
      case 'erro':
      case 'erro_autorizacao':
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
        
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por nome, CPF ou ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
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
                    <td className="px-6 py-4 text-slate-600">
                      {new Date(nota.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">
                        {nota.dados_emissao?.nome || 'Cliente não identificado'}
                      </div>
                      <div className="text-xs text-slate-500">
                        CPF: {nota.dados_emissao?.cpf || 'Não informado'}
                      </div>
                      <div className="text-xs text-slate-400">
                        ID Pag: {nota.pagamento_id || 'Avulsa'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">
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
                        {(nota.status === 'erro' || nota.status === 'pendente' || nota.status === 'erro_autorizacao') && (
                           <button
                             onClick={() => handleReenviar(nota.id)}
                             disabled={processingId === nota.id}
                             className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
                               processingId === nota.id 
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700'
                             }`}
                             title={nota.status === 'pendente' ? "Enviar agora" : "Reenviar Nota"}
                           >
                             <Send size={18} className={processingId === nota.id ? 'animate-pulse' : ''} />
                           </button>
                        )}
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
