import React, { useState } from 'react';
import { useAdminStore } from '../../../stores/adminStore';
import { useModalStore } from '../../../stores/modalStore';
import { TransferModal } from '../modals/TransferModal';
import { CancelModal } from '../modals/CancelModal';
import { FreezeModal } from '../modals/FreezeModal';
import { EditStudentModal } from '../modals/EditStudentModal';
import { DetailModal } from '../modals/DetailModal';
import { RefundPaymentModal } from '../modals/RefundPaymentModal';
import { UpdatePaymentModal } from '../modals/UpdatePaymentModal';
import { CancelPaymentModal } from '../modals/CancelPaymentModal';
import { RefreshCw, Search, X, Edit, CreditCard, DollarSign, Calendar, Eye, FileText, Ban, RotateCcw, Building, Users, Info, Trash2, Edit2, Truck, Lock, XCircle, ExternalLink, Mail, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import { getTodayDateString, formatDateDisplay } from '../../../utils/dateUtils';


const getFilteredTransferTurmas = (enrollment: any, targetUnidade: string, options: any) => {
  if (!enrollment || !targetUnidade) return [];
  const sUnit = targetUnidade.trim().toLowerCase();
  
  return (options?.turmas || []).filter((t: any) => {
    // 1. Match Unit
    const tUnit = (t.unidade_nome || t.unidade || t.unidade_atendimento || "").trim().toLowerCase();
    if (tUnit !== sUnit) return false;
    
    // 2. Match Status
    if ((t.status || 'ativo').toLowerCase() !== 'ativo') return false;
    
    // 3. Match Grade Series
    const studentGrade = enrollment.aluno.serie_ano;
    const seriesData = t.series_permitidas || t.series;
    const hasSeriesDefined = (Array.isArray(seriesData) && seriesData.length > 0) || (typeof seriesData === 'string' && seriesData.length > 0);
    const matchesGrade = !hasSeriesDefined || 
      (studentGrade && Array.isArray(seriesData) && seriesData.includes(studentGrade)) ||
      (studentGrade && typeof seriesData === 'string' && seriesData.split(',').map((s: string) => s.trim()).includes(studentGrade));
      
    if (!matchesGrade) return false;
    
    // 4. Match Age
    const studentBirthDate = enrollment.aluno.data_nascimento;
    let matchesAge = true;
    if (studentBirthDate && t.idade_minima != null && t.idade_maxima != null) {
      if (t.idade_minima === 0 && t.idade_maxima === 0) {
        matchesAge = true;
      } else {
        const birthDate = new Date(studentBirthDate);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        matchesAge = age >= t.idade_minima && age <= t.idade_maxima;
      }
    }
    
    return matchesAge;
  });
};


export default function EnrollmentsTab() {
  const { enrollments, options, loadData } = useAdminStore();
  const [enrollmentSearch, setEnrollmentSearch] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);
  
  const { 
    transferModal, setTransferModal, 
    cancelModal, setCancelModal, 
    freezeModal, setFreezeModal, 
    editStudentModal, setEditStudentModal, 
    detailModal, setDetailModal, 
    refundPaymentModal, setRefundPaymentModal, 
    updatePaymentModal, setUpdatePaymentModal, 
    cancelPaymentModal, setCancelPaymentModal 
  } = useModalStore();

  const flattenedEnrollments = React.useMemo(() => {
    if (!Array.isArray(enrollments)) return [];
    return enrollments.flatMap((responsavel: any) => 
      (responsavel.alunos || []).flatMap((aluno: any) => 
        (aluno.matriculas || []).map((matricula: any) => ({
          ...responsavel,
          alunos: undefined,
          pagamentos: responsavel.pagamentos,
          aluno: { ...aluno, matriculas: undefined },
          matricula: matricula
        }))
      )
    ).sort((a: any, b: any) => new Date(b.matricula.data_matricula).getTime() - new Date(a.matricula.data_matricula).getTime());
  }, [enrollments]);

  const filteredFlattenedEnrollments = React.useMemo(() => {
    if (!enrollmentSearch) return flattenedEnrollments;
    const s = enrollmentSearch.toLowerCase();
    return flattenedEnrollments.filter((e: any) => 
      e.nome_completo?.toLowerCase().includes(s) ||
      e.aluno?.nome_completo?.toLowerCase().includes(s)
    );
  }, [flattenedEnrollments, enrollmentSearch]);

  const getPaymentMethodLabel = (method: string) => {
    if (!method) return 'N/A';
    if (method.includes('credit_card')) return 'Cartão de Crédito';
    if (method.includes('pix')) return 'PIX';
    if (method.includes('boleto')) return 'Boleto';
    return method;
  };

  const renderPlano = (plano: string) => {
    if (!plano) return <span className="text-slate-400">-</span>;
    if (plano.toLowerCase().includes('anual')) {
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold"><Calendar size={12} /> Anual</span>;
    }
    if (plano.toLowerCase().includes('semestral')) {
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold"><Calendar size={12} /> Semestral</span>;
    }
    if (plano.toLowerCase().includes('mensal')) {
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold"><Calendar size={12} /> Mensal</span>;
    }
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold"><Calendar size={12} /> {plano}</span>;
  };


  const confirmRefundPayment = async () => {
    const { paymentId, amount: amountStr, isTotal } = refundPaymentModal;
    const amount = !isTotal && amountStr.trim() ? parseFloat(amountStr.replace(',', '.')) : null;
    if (!isTotal && amountStr.trim() && isNaN(amount as number)) {
      toast.error('Valor inválido.');
      return;
    }
    setLoadingAction(true);
    try {
      const response = await fetch(`/api/payments/refund/${paymentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      });
      const data = await response.json();
      if (response.ok) {
        toast.success('Estorno realizado com sucesso!');
        setRefundPaymentModal({ isOpen: false, paymentId: '', amount: '', isTotal: true });
        loadData();
      } else {
        toast.error(`Erro ao estornar: ${data.error}`);
      }
    } catch (error) {
      toast.error('Erro de conexão ao realizar estorno.');
    } finally {
      setLoadingAction(false);
    }
  };

  const confirmUpdatePaymentValue = async () => {
    const { paymentId, newValue: newValueStr } = updatePaymentModal;
    const newValue = parseFloat(newValueStr.replace(',', '.'));
    if (isNaN(newValue) || newValue <= 0) {
      toast.error('Valor inválido.');
      return;
    }
    setLoadingAction(true);
    try {
      const response = await fetch(`/api/payments/update-value/${paymentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newValue: newValue, updateFutureInstallments: updatePaymentModal.updateFuture })
      });
      if (response.ok) {
        toast.success('Valor atualizado com sucesso!');
        setUpdatePaymentModal({ isOpen: false, paymentId: '', currentAmount: 0, newValue: '', updateFuture: false });
        loadData();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Erro ao atualizar valor.');
      }
    } catch (error) {
      toast.error('Erro de conexão.');
    } finally {
      setLoadingAction(false);
    }
  };

  const executeTransferEnrollment = async () => {
    if (!transferModal.enrollmentId) return;
    setLoadingAction(true);
    try {
      const res = await fetch('/api/enrollment/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentId: transferModal.enrollmentId,
          targetTurma: transferModal.targetTurma,
          targetUnidade: transferModal.targetUnidade
        })
      });
      if (res.ok) {
        toast.success('Matrícula transferida com sucesso!');
        setTransferModal({ isOpen: false, enrollmentId: null, targetTurma: '', targetUnidade: '' });
        loadData();
      } else {
        toast.error('Erro ao transferir matrícula.');
      }
    } catch {
      toast.error('Erro de conexão ao transferir.');
    } finally {
      setLoadingAction(false);
    }
  };

  const executeCancelEnrollment = async () => {
    if (!cancelModal.enrollmentId) return;
    setLoadingAction(true);
    try {
      const res = await fetch('/api/enrollment/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentId: cancelModal.enrollmentId,
          cancellationDate: cancelModal.date,
          justificativa: cancelModal.reason
        })
      });
      if (res.ok) {
        toast.success('Matrícula cancelada com sucesso!');
        setCancelModal({ isOpen: false, enrollmentId: null, reason: '', date: '' });
        loadData();
      } else {
        toast.error('Erro ao cancelar matrícula.');
      }
    } catch {
      toast.error('Erro de conexão ao cancelar.');
    } finally {
      setLoadingAction(false);
    }
  };

  const executeFreezeEnrollment = async () => {
    if (!freezeModal.enrollmentId) return;
    setLoadingAction(true);
    try {
      const res = await fetch('/api/enrollment/freeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentId: freezeModal.enrollmentId,
          startDate: freezeModal.startDate,
          endDate: freezeModal.endDate
        })
      });
      if (res.ok) {
        toast.success('Matrícula trancada com sucesso!');
        setFreezeModal({ isOpen: false, enrollmentId: null, startDate: '', endDate: '' });
        loadData();
      } else {
        toast.error('Erro ao trancar matrícula.');
      }
    } catch {
      toast.error('Erro de conexão ao trancar.');
    } finally {
      setLoadingAction(false);
    }
  };

  const executeEditStudent = async () => {
    if (!editStudentModal.studentId) return;
    setLoadingAction(true);
    try {
      const res = await fetch('/api/students/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: editStudentModal.studentId,
          nome_completo: editStudentModal.nome_completo,
          unidade_origem_id: editStudentModal.unidade_origem_id || null
        })
      });
      if (res.ok) {
        toast.success('Aluno atualizado com sucesso!');
        setEditStudentModal({ isOpen: false, studentId: null, nome_completo: '', unidade_origem_id: '' });
        loadData();
      } else {
        toast.error('Erro ao atualizar aluno.');
      }
    } catch {
      toast.error('Erro de conexão ao atualizar.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleImpersonate = async (cpf: string) => {
    if (!cpf) return toast.error('Responsável não possui CPF/ID válido.');
    
    try {
      const toastId = toast.loading('Acessando painel...');
      const adminToken = sessionStorage.getItem('admin_token');
      
      const response = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ id: cpf }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        toast.error(data.error || 'Erro ao acessar painel', { id: toastId });
        return;
      }
      
      const studentsData = (data.alunos || []).map((a: any) => ({
        id: a.aluno_id || a.id,
        enrollmentId: a.id,
        nome_completo: a.nome_completo,
        serie_ano: a.serie_ano,
        data_nascimento: a.data_nascimento,
        turma: a.turma,
        unidade: a.unidade,
        status: a.status,
        data_matricula: a.data_matricula,
        pagarme_subscription_id: a.pagarme_subscription_id,
        data_cancelamento: a.data_cancelamento,
        horario: a.horario
      }));
      
      localStorage.setItem('guardian', JSON.stringify({ ...data, students: studentsData }));
      localStorage.setItem('admin_impersonating', 'true');
      if (data.isReadOnly) {
        localStorage.setItem('admin_read_only', 'true');
      } else {
        localStorage.removeItem('admin_read_only');
      }
      
      toast.success('Acesso concedido', { id: toastId });
      
      // Redirect to the student portal page in a new tab
      window.open('https://www.sportforkids.com.br/portal', '_blank');
    } catch (error) {
      console.error('Error impersonating:', error);
      toast.error('Erro na requisição');
    }
  };

  const confirmCancelPayment = async () => {
    setLoadingAction(true);
    try {
      const response = await fetch(`/api/payments/cancel/${cancelPaymentModal.paymentId}`, {
        method: 'POST'
      });
      if (response.ok) {
        toast.success('Pagamento cancelado com sucesso!');
        setCancelPaymentModal({ isOpen: false, paymentId: '' });
        loadData();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Erro ao cancelar pagamento.');
      }
    } catch (error) {
      toast.error('Erro de conexão ao cancelar pagamento.');
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <>
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex gap-4 items-center">
                    <input 
                      type="text" 
                      placeholder="Pesquisar por aluno ou responsável..." 
                      value={enrollmentSearch}
                      onChange={e => setEnrollmentSearch(e.target.value)}
                      className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                            <th className="p-4">Data</th>
                            <th className="p-4">Responsável</th>
                            <th className="p-4">Aluno</th>
                            <th className="p-4">Turma</th>
                            <th className="p-4">Plano</th>
                            <th className="p-4">Método</th>
                            <th className="p-4 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredFlattenedEnrollments.map((e: any) => {
                            const payment = e.pagamentos?.find((p: any) => p.matricula_id === e.matricula.id);
                            const methodLabel = payment ? getPaymentMethodLabel(payment.metodo_pagamento) : 'N/A';
                            const paymentStatus = payment?.status?.toLowerCase() || 'pendente';
                            const matriculaStatus = (e.matricula.status || '').toLowerCase();
                            
                            return (
                              <tr key={e.matricula.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                                {/* DATA */}
                                <td className="p-4">
                                  <div className="font-extrabold text-slate-800 text-xs">
                                    {formatDateDisplay(e.matricula.data_matricula)}
                                  </div>
                                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                                    Data Matrícula
                                  </div>
                                </td>

                                {/* RESPONSÁVEL */}
                                <td className="p-4">
                                  <div className="font-semibold text-slate-800 text-xs">
                                    {e.nome_completo}
                                  </div>
                                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                                    Responsável
                                  </div>
                                </td>

                                {/* ALUNO */}
                                <td className="p-4">
                                  <div className="font-semibold text-slate-800 text-xs">
                                    {e.aluno.nome_completo}
                                  </div>
                                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                                    {e.aluno.serie_ano || 'Sem Série'}
                                  </div>
                                </td>

                                {/* TURMA */}
                                <td className="p-4">
                                  <div className="font-semibold text-emerald-600 text-xs">
                                    {e.matricula.turma}
                                  </div>
                                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 mb-1.5">
                                    {e.matricula.unidade}
                                  </div>
                                  <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                    matriculaStatus === 'ativo'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                      : matriculaStatus === 'pendente'
                                        ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                        : matriculaStatus === 'trancado'
                                          ? 'bg-orange-50 text-orange-700 border border-orange-100'
                                          : 'bg-rose-50 text-rose-700 border border-rose-100'
                                  }`}>
                                    {e.matricula.status}
                                  </span>
                                </td>

                                {/* PLANO */}
                                <td className="p-4">
                                  {renderPlano(e.matricula.plano)}
                                </td>

                                {/* MÉTODO */}
                                <td className="p-4">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <CreditCard size={14} className="text-indigo-500" />
                                    <span className="font-semibold text-slate-700 text-xs">{methodLabel}</span>
                                  </div>
                                  <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                    paymentStatus === 'pago' || paymentStatus === 'conciliado'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                      : 'bg-amber-50 text-amber-700 border border-amber-100'
                                  }`}>
                                    {paymentStatus === 'pago' || paymentStatus === 'conciliado' ? 'Conciliado' : 'Pendente'}
                                  </span>
                                </td>

                                {/* AÇÕES */}
                                <td className="p-4 text-right space-x-1 whitespace-nowrap">
                                  {sessionStorage.getItem('admin_role') === 'master' && (
                                    <>
                                      <button 
                                        disabled={matriculaStatus !== 'ativo' && matriculaStatus !== 'pendente'}
                                        onClick={() => setFreezeModal({ isOpen: true, enrollmentId: e.matricula.id, startDate: getTodayDateString(), endDate: '' })}
                                        className="p-1 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                                        title="Suspender Matrícula"
                                      >
                                        <Lock size={16} />
                                      </button>
                                      <button 
                                        disabled={matriculaStatus !== 'ativo' && matriculaStatus !== 'pendente'}
                                        onClick={() => setTransferModal({ isOpen: true, enrollmentId: e.matricula.id, targetTurma: '', targetUnidade: '' })}
                                        className="p-1 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                                        title="Transferir Turma"
                                      >
                                        <Truck size={16} />
                                      </button>
                                      <button 
                                        disabled={matriculaStatus !== 'ativo' && matriculaStatus !== 'pendente'}
                                        onClick={() => setCancelModal({ isOpen: true, enrollmentId: e.matricula.id, reason: '', date: getTodayDateString() })}
                                        className="p-1 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                                        title="Cancelar Matrícula"
                                      >
                                        <XCircle size={16} />
                                      </button>
                                      <button 
                                        onClick={() => setEditStudentModal({ isOpen: true, studentId: e.aluno.id, nome_completo: e.aluno.nome_completo, unidade_origem_id: e.aluno.unidade_origem_id || '' })}
                                        className="p-1 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                        title="Editar Aluno"
                                      >
                                        <Edit size={16} />
                                      </button>
                                    </>
                                  )}
                                  <button 
                                    onClick={() => setDetailModal({ isOpen: true, enrollment: e })}
                                    className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded transition-colors"
                                    title="Ver Detalhes"
                                  >
                                    <ExternalLink size={16} />
                                  </button>
                                  {sessionStorage.getItem('admin_role') === 'master' && (
                                    <button 
                                      onClick={() => handleImpersonate(e.matricula.responsavel_id || e.id)}
                                      className="p-1 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
                                      title="Acessar painel como responsável"
                                    >
                                      <Eye size={16} />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

      {/* MODALS */}
      <TransferModal 
        activeEnrollment={transferModal.isOpen ? filteredFlattenedEnrollments.find((e: any) => e.matricula.id === transferModal.enrollmentId) : null}
        options={options}
        filteredTurmas={transferModal.isOpen ? getFilteredTransferTurmas(filteredFlattenedEnrollments.find((e: any) => e.matricula.id === transferModal.enrollmentId), transferModal.targetUnidade, options) : []}
        loadingAction={loadingAction}
        executeTransferEnrollment={executeTransferEnrollment}
      />
      <CancelModal loadingAction={loadingAction} executeCancelEnrollment={executeCancelEnrollment} />
      <FreezeModal loadingAction={loadingAction} executeFreezeEnrollment={executeFreezeEnrollment} />
      <EditStudentModal options={options} loadingAction={loadingAction} executeEditStudent={executeEditStudent} />
      <DetailModal />
      <RefundPaymentModal loadingAction={loadingAction} confirmRefundPayment={confirmRefundPayment} />
      <UpdatePaymentModal loadingAction={loadingAction} confirmUpdatePaymentValue={confirmUpdatePaymentValue} />
      <CancelPaymentModal loadingAction={loadingAction} confirmCancelPayment={confirmCancelPayment} />

    </>
  );
}
