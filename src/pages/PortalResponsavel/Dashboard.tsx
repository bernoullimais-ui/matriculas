import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, FileText, Download, Calendar, DollarSign, User as UserIcon, Tag, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PortalDashboard() {
  const navigate = useNavigate();
  const [guardian, setGuardian] = useState<any>(null);
  const [data, setData] = useState<any>({ matriculas: [], pagamentos: [], eventos: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionData = sessionStorage.getItem('guardian_data');
    if (!sessionData) {
      navigate('/area-do-cliente');
      return;
    }

    try {
      const parsed = JSON.parse(sessionData);
      setGuardian(parsed);
      fetchDashboardData(parsed.id);
    } catch (e) {
      navigate('/area-do-cliente');
    }
  }, [navigate]);

  const fetchDashboardData = async (guardianId: string) => {
    try {
      const res = await fetch(`/api/portal/history/${guardianId}`);
      const json = await res.json();
      if (res.ok) {
        setData(json);
      } else {
        toast.error('Erro ao buscar dados do painel.');
      }
    } catch (e) {
      toast.error('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('guardian_token');
    sessionStorage.removeItem('guardian_data');
    navigate('/area-do-cliente');
  };

  const handleDownloadReceipt = (paymentId: string) => {
    window.open(`/api/portal/documents/receipt/${paymentId}`, '_blank');
  };

  const handleDownloadContract = (enrollmentId: string) => {
    window.open(`/api/portal/documents/contract/${enrollmentId}`, '_blank');
  };

  if (loading || !guardian) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-lg">
            {guardian.nome_completo?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div>
            <h1 className="font-bold text-slate-800 leading-tight">Olá, {guardian.nome_completo?.split(' ')[0]}</h1>
            <p className="text-xs text-slate-500 font-medium">Área do Cliente</p>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors"
        >
          <LogOut size={16} /> <span className="hidden sm:inline">Sair</span>
        </button>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        
        {/* Matriculas Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <UserIcon className="text-indigo-600" size={24} />
            <h2 className="text-xl font-bold text-slate-800">Alunos Matriculados</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.matriculas.length === 0 ? (
              <div className="col-span-full p-8 text-center bg-white border border-slate-200 rounded-3xl text-slate-500">
                Nenhum aluno matriculado atrelado a este perfil.
              </div>
            ) : (
              data.matriculas.map((mat: any) => (
                <div key={mat.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg text-slate-800">{mat.aluno_nome}</h3>
                      <p className="text-sm text-slate-500">{mat.turmas?.nome || 'Turma não informada'}</p>
                    </div>
                    <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg ${mat.status === 'Ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {mat.status}
                    </span>
                  </div>
                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button 
                      onClick={() => handleDownloadContract(mat.id)}
                      className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      <FileText size={16} /> Baixar Contrato
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Historico Financeiro Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="text-emerald-600" size={24} />
            <h2 className="text-xl font-bold text-slate-800">Histórico Financeiro</h2>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase text-[10px] font-bold tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Referência</th>
                    <th className="px-6 py-4">Valor</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Documento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {data.pagamentos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                        Nenhum pagamento registrado.
                      </td>
                    </tr>
                  ) : (
                    data.pagamentos.map((pag: any, index: number) => (
                      <tr key={pag.id || index} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Clock size={14} className="text-slate-400" />
                            {new Date(pag.date).toLocaleDateString('pt-BR')}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-800">{pag.title}</td>
                        <td className="px-6 py-4">
                          R$ {Number(pag.valor || pag.valor_total || pag.valor_pago || 0).toFixed(2).replace('.', ',')}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-md text-[10px] uppercase tracking-wider font-bold ${
                            pag.status?.toLowerCase().includes('pago') || pag.status?.toLowerCase().includes('conclu') || pag.status?.toLowerCase().includes('aprovado') 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : pag.status?.toLowerCase().includes('falho') || pag.status?.toLowerCase().includes('recusado')
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {pag.status || 'Pendente'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {/* Only show receipt button if it's paid and it's a type that supports receipts natively via the endpoint */}
                          {pag.id && (pag.status?.toLowerCase().includes('pago') || pag.status?.toLowerCase().includes('conclu') || pag.status?.toLowerCase().includes('aprovado')) ? (
                            <button 
                              onClick={() => handleDownloadReceipt(pag.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-colors"
                            >
                              <Download size={14} /> Recibo
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
