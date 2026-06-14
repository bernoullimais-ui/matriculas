import React, { useState } from 'react';
import { useAdminStore } from '../../../stores/adminStore';
import { RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { getTodayDateString } from '../../../utils/dateUtils';

export default function TasksTab() {
  const { tasks, waitlist, options, loadData } = useAdminStore();
  const [showAllResolvedTasks, setShowAllResolvedTasks] = useState(false);
  
  // Modals specific to tasks
  const [showNotifyModal, setShowNotifyModal] = useState<{ isOpen: boolean, item: any | null }>({ isOpen: false, item: null });
  const [approveCancelModal, setApproveCancelModal] = useState<{ isOpen: boolean, task: any | null, date: string }>({ isOpen: false, task: null, date: '' });
  const [loadingAction, setLoadingAction] = useState(false);

  const mergedTasks = React.useMemo(() => {
    if (!Array.isArray(tasks)) return [];
    
    const waitlistTasks = waitlist
      .filter(item => {
        if (item.status === 'chamado') return false;
        const turma = options?.turmas?.find((t: any) => t.nome === item.turma);
        return turma && (turma.ocupacao_atual || 0) < (turma.capacidade || 0);
      })
      .map(item => ({
        id: `waitlist-${item.id}`,
        tipo: 'vaga_disponivel',
        status: 'pendente',
        created_at: item.created_at,
        alunos: { nome_completo: item.estudante },
        responsaveis: { nome_completo: item.responsavel1 },
        detalhes: {
          turma: item.turma,
          unidade: item.unidade,
          waitlistItem: item
        }
      }));

    return [...tasks, ...waitlistTasks].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [tasks, waitlist, options]);

  const pendingTasks = mergedTasks.filter((t: any) => t.status === 'pendente');
  const resolvedTasks = mergedTasks.filter((t: any) => t.status !== 'pendente');
  const visibleResolvedTasks = showAllResolvedTasks ? resolvedTasks : resolvedTasks.slice(0, 5);
  const visibleTasks = [...pendingTasks, ...visibleResolvedTasks];
  const hasMoreResolved = resolvedTasks.length > 5;

  const handleNotifyVacancy = (waitlistItem: any) => {
    setShowNotifyModal({ isOpen: true, item: waitlistItem });
  };

  const confirmNotifyVacancy = async () => {
    if (!showNotifyModal.item) return;
    setLoadingAction(true);
    try {
      const res = await fetch('/api/waitlist/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waitlistId: showNotifyModal.item.id,
          whatsapp: showNotifyModal.item.whatsapp1
        })
      });
      if (res.ok) {
        toast.success('Responsável notificado por WhatsApp com sucesso!');
        setShowNotifyModal({ isOpen: false, item: null });
        loadData();
      } else {
        toast.error('Falha ao notificar vaga.');
      }
    } catch {
      toast.error('Erro de conexão ao notificar.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleApproveTask = async (task: any, cancellationDate?: string) => {
    if (task.tipo === 'cancelamento' && !cancellationDate) {
      setApproveCancelModal({
        isOpen: true,
        task,
        date: task.detalhes?.data_cancelamento || getTodayDateString()
      });
      return;
    }

    setLoadingAction(true);
    try {
      let endpoint = '';
      let payload: any = {};
      
      if (task.tipo === 'cancelamento') {
        endpoint = '/api/enrollment/cancel';
        payload = {
          enrollmentId: task.matricula_id,
          cancellationDate: cancellationDate || task.detalhes?.data_cancelamento,
          justificativa: task.detalhes?.justificativa
        };
      } else if (task.tipo === 'transferencia') {
        endpoint = '/api/enrollment/transfer';
        payload = {
          enrollmentId: task.matricula_id,
          newTurma: task.detalhes?.nova_turma,
          newUnidade: task.detalhes?.nova_unidade
        };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        await fetch('/api/tasks/update-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId: task.id, status: 'concluido' })
        });
        toast.success('Solicitação aprovada e processada!');
        setApproveCancelModal({ isOpen: false, task: null, date: '' });
        loadData();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Erro ao processar solicitação.');
      }
    } catch {
      toast.error('Erro de conexão ao processar.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleRejectTask = async (taskId: string) => {
    if (!window.confirm('Deseja realmente rejeitar esta solicitação?')) return;
    setLoadingAction(true);
    try {
      const res = await fetch('/api/tasks/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, status: 'rejeitado' })
      });
      if (res.ok) {
        toast.success('Solicitação rejeitada com sucesso.');
        loadData();
      } else {
        toast.error('Erro ao rejeitar solicitação.');
      }
    } catch {
      toast.error('Erro de conexão.');
    } finally {
      setLoadingAction(false);
    }
  };

  const userRole = sessionStorage.getItem('admin_role') as string;

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-800">Fila de Aprovação de Solicitações</h3>
          <button onClick={() => loadData()} className="p-2 text-slate-400 hover:text-slate-600"><RefreshCw size={18} /></button>
        </div>
        
        <div className="space-y-3">
          {visibleTasks.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-100 shadow-sm text-slate-400">Nenhuma tarefa aguardando aprovação.</div>
          ) : (
            <>
              {visibleTasks.map((t: any) => (
                <div key={t.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-block text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                        {t.tipo === 'vaga_disponivel' ? 'Vaga Disponível' : t.tipo === 'cancelamento' ? 'Cancelamento' : 'Transferência'}
                      </span>
                      <span className={`inline-block text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full ${
                        t.status === 'pendente' ? 'bg-amber-100 text-amber-700' :
                        t.status === 'concluido' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-rose-100 text-rose-700'
                      }`}>
                        {t.status === 'pendente' ? 'Pendente' :
                         t.status === 'concluido' ? 'Concluído' : 'Rejeitado'}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-800">{t.alunos?.nome_completo || t.matriculas?.alunos?.nome_completo || 'Aluno'}</h4>
                    <p className="text-xs text-slate-500">Responsável: {t.responsaveis?.nome_completo || 'N/A'}</p>
                    {t.detalhes?.justificativa && (
                      <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 italic">"{t.detalhes.justificativa}"</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {t.status === 'pendente' ? (
                      userRole === 'master' ? (
                        t.tipo === 'vaga_disponivel' ? (
                          <button onClick={() => handleNotifyVacancy(t.detalhes.waitlistItem)} className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700">Notificar Vaga</button>
                        ) : (
                          <>
                            <button onClick={() => handleRejectTask(t.id)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Rejeitar</button>
                            <button onClick={() => handleApproveTask(t)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl">Aprovar</button>
                          </>
                        )
                      ) : (
                        <span className="text-[10px] text-amber-600 font-bold px-3 py-1.5 bg-amber-50 rounded-xl border border-amber-100">Somente Visualização</span>
                      )
                    ) : (
                      <span className={`px-3 py-1.5 text-[10px] font-bold rounded-xl border ${t.status === 'concluido' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {t.status === 'concluido' ? 'Concluído' : 'Rejeitado'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {hasMoreResolved && !showAllResolvedTasks && (
                <div className="text-center pt-4">
                  <button 
                    onClick={() => setShowAllResolvedTasks(true)} 
                    className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold rounded-xl transition-colors"
                  >
                    Ver mais
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* MODALS */}
      {showNotifyModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-3xl max-w-sm w-full border border-slate-200 shadow-xl">
            <h3 className="font-bold text-slate-800 text-lg mb-2">Notificar Vaga Disponível?</h3>
            <p className="text-xs text-slate-500 mb-6">Esta ação enviará uma notificação automática via WhatsApp para o contato cadastrado do responsável para realizar a inscrição.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowNotifyModal({ isOpen: false, item: null })} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-50">Cancelar</button>
              <button onClick={confirmNotifyVacancy} disabled={loadingAction} className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold">
                {loadingAction ? 'Enviando...' : 'Notificar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {approveCancelModal.isOpen && approveCancelModal.task && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl relative p-6">
            <h2 className="text-xl font-black text-slate-800 mb-4">Aprovar Cancelamento</h2>
            <p className="text-sm text-slate-600 mb-4">Confirme a data efetiva do cancelamento para prosseguir com a aprovação.</p>
            
            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Data do Cancelamento</label>
              <input 
                type="date"
                value={approveCancelModal.date}
                onChange={e => setApproveCancelModal({ ...approveCancelModal, date: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-medium"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setApproveCancelModal({ isOpen: false, task: null, date: '' })}
                className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                disabled={loadingAction}
              >
                Voltar
              </button>
              <button 
                onClick={() => handleApproveTask(approveCancelModal.task, approveCancelModal.date)}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                disabled={loadingAction || !approveCancelModal.date}
              >
                {loadingAction ? 'Processando...' : 'Confirmar Aprovação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
