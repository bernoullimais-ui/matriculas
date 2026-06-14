import React, { useState } from 'react';
import { useAdminStore } from '../../../stores/adminStore';
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
  
  // Modals
  const [cancelModal, setCancelModal] = useState<{ isOpen: boolean, enrollmentId: string | null, reason: string, date: string }>({
    isOpen: false, enrollmentId: null, reason: '', date: getTodayDateString()
  });
  const [freezeModal, setFreezeModal] = useState<{ isOpen: boolean, enrollmentId: string | null, startDate: string, endDate: string }>({
    isOpen: false, enrollmentId: null, startDate: getTodayDateString(), endDate: ''
  });
  const [editStudentModal, setEditStudentModal] = useState<{ isOpen: boolean; studentId: string | null; nome_completo: string; unidade_origem_id: string; }>({ isOpen: false, studentId: null, nome_completo: '', unidade_origem_id: '' });
  const [transferModal, setTransferModal] = useState<{ isOpen: boolean, enrollmentId: string | null, targetTurma: string, targetUnidade: string }>({
    isOpen: false, enrollmentId: null, targetTurma: '', targetUnidade: ''
  });
  const [detailModal, setDetailModal] = useState<{ isOpen: boolean, enrollment: any | null }>({
    isOpen: false, enrollment: null
  });
  const [refundPaymentModal, setRefundPaymentModal] = useState<{ isOpen: boolean, paymentId: string, amount: string, isTotal: boolean }>({ isOpen: false, paymentId: '', amount: '', isTotal: true });
  const [updatePaymentModal, setUpdatePaymentModal] = useState<{ isOpen: boolean, paymentId: string, currentAmount: number, newValue: string, updateFuture: boolean }>({ isOpen: false, paymentId: '', currentAmount: 0, newValue: '', updateFuture: false });
  const [cancelPaymentModal, setCancelPaymentModal] = useState<{ isOpen: boolean, paymentId: string }>({ isOpen: false, paymentId: '' });

  const filteredEnrollments = React.useMemo(() => {
    if (!Array.isArray(enrollments)) return [];
    if (!enrollmentSearch) return enrollments;
    const s = enrollmentSearch.toLowerCase();
    return enrollments.filter((e: any) => 
      e.nome_completo?.toLowerCase().includes(s) ||
      e.aluno?.nome_completo?.toLowerCase().includes(s)
    );
  }, [enrollments, enrollmentSearch]);

  const filteredFlattenedEnrollments = React.useMemo(() => {
    return filteredEnrollments.flatMap((responsavel: any) => 
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
  }, [filteredEnrollments]);

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
    if (!cpf) return toast.error('Responsável não possui CPF.');
    toast.success(`Acessando como ${cpf}... (simulação)`);
    console.log(`Impersonating ${cpf}`);
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
                                    e.matricula.status === 'ativo'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                      : e.matricula.status === 'pendente'
                                        ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                        : e.matricula.status === 'trancado'
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
                                        disabled={e.matricula.status !== 'ativo' && e.matricula.status !== 'pendente'}
                                        onClick={() => setFreezeModal({ isOpen: true, enrollmentId: e.matricula.id, startDate: getTodayDateString(), endDate: '' })}
                                        className="p-1 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                                        title="Suspender Matrícula"
                                      >
                                        <Lock size={16} />
                                      </button>
                                      <button 
                                        disabled={e.matricula.status !== 'ativo' && e.matricula.status !== 'pendente'}
                                        onClick={() => setTransferModal({ isOpen: true, enrollmentId: e.matricula.id, targetTurma: '', targetUnidade: '' })}
                                        className="p-1 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                                        title="Transferir Turma"
                                      >
                                        <Truck size={16} />
                                      </button>
                                      <button 
                                        disabled={e.matricula.status !== 'ativo' && e.matricula.status !== 'pendente'}
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
      {transferModal.isOpen && (() => {
        const activeEnrollment = filteredFlattenedEnrollments.find((e: any) => e.matricula.id === transferModal.enrollmentId);
        const filteredTurmas = activeEnrollment ? getFilteredTransferTurmas(activeEnrollment, transferModal.targetUnidade, options) : [];
        
        return (
          <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white p-6 rounded-3xl max-w-sm w-full border border-slate-200 shadow-xl space-y-4">
              
              {/* Header with Truck Icon */}
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <Truck size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Transferir Turma</h3>
                  <p className="text-xs text-slate-400">Mude o aluno de turma ou unidade.</p>
                </div>
              </div>

              {/* Student Card Info */}
              {activeEnrollment && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1">
                  <div className="font-bold text-slate-800 text-xs">{activeEnrollment.aluno.nome_completo}</div>
                  <div className="text-[10px] text-slate-500">{activeEnrollment.aluno.serie_ano || 'Sem Série'}</div>
                </div>
              )}

              {/* Nova Unidade Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nova Unidade</label>
                <select 
                  value={transferModal.targetUnidade} 
                  onChange={e => setTransferModal({ ...transferModal, targetUnidade: e.target.value, targetTurma: '' })} 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-700"
                >
                  <option value="">Selecione a unidade...</option>
                  {(options?.unidades || []).map((u: string) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              {/* Nova Turma Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nova Turma</label>
                <select 
                  disabled={!transferModal.targetUnidade}
                  value={transferModal.targetTurma} 
                  onChange={e => setTransferModal({ ...transferModal, targetTurma: e.target.value })} 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-700 disabled:opacity-50"
                >
                  <option value="">Selecione a turma...</option>
                  {filteredTurmas.map((t: any) => (
                    <option key={t.id} value={t.nome}>{t.nome}</option>
                  ))}
                </select>
              </div>

              {/* Actions footer */}
              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => setTransferModal({ isOpen: false, enrollmentId: null, targetTurma: '', targetUnidade: '' })} 
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-50 text-slate-600"
                >
                  Voltar
                </button>
                <button 
                  onClick={executeTransferEnrollment} 
                  disabled={loadingAction || !transferModal.targetTurma || !transferModal.targetUnidade} 
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                >
                  {loadingAction ? 'Gravando...' : 'Transferir'}
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {cancelModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-3xl max-w-sm w-full border border-slate-200 shadow-xl space-y-4">
            <h3 className="font-bold text-slate-800 text-lg">Cancelar Matrícula</h3>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Efetiva</label>
              <input type="date" value={cancelModal.date} onChange={e => setCancelModal({ ...cancelModal, date: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Justificativa</label>
              <textarea value={cancelModal.reason} onChange={e => setCancelModal({ ...cancelModal, reason: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm h-20" />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setCancelModal({ isOpen: false, enrollmentId: null, reason: '', date: '' })} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-50">Fechar</button>
              <button onClick={executeCancelEnrollment} disabled={loadingAction} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold">
                {loadingAction ? 'Processando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {freezeModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-3xl max-w-sm w-full border border-slate-200 shadow-xl space-y-4">
            <h3 className="font-bold text-slate-800 text-lg">Trancar Matrícula</h3>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data de Início</label>
              <input type="date" value={freezeModal.startDate} onChange={e => setFreezeModal({ ...freezeModal, startDate: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Prevista de Retorno</label>
              <input type="date" value={freezeModal.endDate} onChange={e => setFreezeModal({ ...freezeModal, endDate: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setFreezeModal({ isOpen: false, enrollmentId: null, startDate: '', endDate: '' })} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-50">Fechar</button>
              <button onClick={executeFreezeEnrollment} disabled={loadingAction} className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold">
                {loadingAction ? 'Processando...' : 'Trancar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editStudentModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-3xl max-w-sm w-full border border-slate-200 shadow-xl space-y-4">
            <h3 className="font-bold text-slate-800 text-lg">Editar Aluno</h3>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
              <input 
                type="text" 
                value={editStudentModal.nome_completo} 
                onChange={e => setEditStudentModal({ ...editStudentModal, nome_completo: e.target.value })} 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unidade de Vínculo</label>
              <select 
                value={editStudentModal.unidade_origem_id} 
                onChange={e => setEditStudentModal({ ...editStudentModal, unidade_origem_id: e.target.value })} 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              >
                <option value="">Nenhuma / Sem Vínculo</option>
                {options.unidades?.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditStudentModal({ isOpen: false, studentId: null, nome_completo: '', unidade_origem_id: '' })} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-50">Fechar</button>
              <button onClick={executeEditStudent} disabled={loadingAction} className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold">
                {loadingAction ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailModal.isOpen && detailModal.enrollment && (() => {
        const e = detailModal.enrollment;
        const payment = e.pagamentos?.find((p: any) => p.matricula_id === e.matricula.id);
        const methodLabel = payment ? getPaymentMethodLabel(payment.metodo_pagamento) : 'N/A';
        const paymentStatus = payment?.status?.toLowerCase() || 'pendente';
        
        return (
          <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white p-6 rounded-3xl max-w-xl w-full border border-slate-200 shadow-xl space-y-5">
              
              {/* Header */}
              <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                  <Users size={24} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-lg">Detalhes da Matrícula</h3>
                  <p className="text-xs text-slate-400">Informações completas do aluno e responsável.</p>
                </div>
                <button 
                  onClick={() => setDetailModal({ isOpen: false, enrollment: null })} 
                  className="ml-auto p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                >
                  <XCircle size={20} />
                </button>
              </div>

              {/* Grid content */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Column 1 */}
                <div className="space-y-4">
                  {/* Responsável Card */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Responsável</h4>
                    <div className="font-bold text-slate-800 text-sm">{e.nome_completo}</div>
                    <div className="space-y-1.5 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Mail size={14} className="text-slate-400 shrink-0" />
                        <span className="truncate">{e.email || 'Não cadastrado'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Phone size={14} className="text-slate-400 shrink-0" />
                        <span>{e.telefone || 'Não cadastrado'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CreditCard size={14} className="text-slate-400 shrink-0" />
                        <span>CPF: {e.cpf || 'Não cadastrado'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Aluno Card */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aluno</h4>
                    <div className="font-bold text-slate-800 text-sm">{e.aluno.nome_completo}</div>
                    <div className="text-xs text-slate-500 space-y-1">
                      <div><span className="font-semibold text-slate-600">Série/Ano:</span> {e.aluno.serie_ano || '—'}</div>
                      <div><span className="font-semibold text-slate-600">Nascimento:</span> {e.aluno.data_nascimento ? formatDateDisplay(e.aluno.data_nascimento) : '—'}</div>
                    </div>
                  </div>
                </div>

                {/* Column 2 */}
                <div className="space-y-4">
                  {/* Matrícula Card */}
                  <div className="bg-emerald-50/15 border border-emerald-100/50 p-4 rounded-2xl space-y-3 relative">
                    <span className={`absolute top-4 right-4 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      e.matricula.status === 'ativo'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : e.matricula.status === 'pendente'
                          ? 'bg-amber-50 text-amber-700 border border-amber-100'
                          : e.matricula.status === 'trancado'
                            ? 'bg-orange-50 text-orange-700 border border-orange-100'
                            : 'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}>
                      {e.matricula.status}
                    </span>
                    
                    <h4 className="text-[10px] font-bold text-emerald-700/70 uppercase tracking-wider">Matrícula</h4>
                    <div>
                      <div className="font-bold text-emerald-800 text-sm">{e.matricula.turma}</div>
                      <div className="text-xs text-emerald-600/80">{e.matricula.unidade}</div>
                    </div>
                    <div className="text-xs text-slate-600 space-y-1 pt-1 border-t border-emerald-100/40">
                      <div><span className="font-semibold text-slate-500">Plano:</span> <span className="font-bold uppercase text-[10px]">{e.matricula.plano || 'PADRÃO'}</span></div>
                      <div><span className="font-semibold text-slate-500">Data Matrícula:</span> {e.matricula.data_matricula ? formatDateDisplay(e.matricula.data_matricula) : '—'}</div>
                    </div>
                  </div>

                  {/* Pagamento Card */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pagamento</h4>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <CreditCard size={14} className="text-indigo-500" />
                        <span className="font-semibold text-slate-800 text-xs uppercase">{methodLabel}</span>
                      </div>
                      <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        paymentStatus === 'pago' || paymentStatus === 'conciliado'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {paymentStatus === 'pago' || paymentStatus === 'conciliado' ? 'Conciliado' : 'Pendente'}
                      </span>
                    </div>
                    {payment?.valor != null && (
                      <div className="text-sm font-bold text-slate-700 mt-1">
                        R$ {payment.valor.toFixed(2).replace('.', ',')}
                      </div>
                    )}
                    {payment?.pagarme && (
                      <div className="text-[10px] text-slate-400 break-all pt-1 border-t border-slate-200/50">
                        ID: {payment.pagarme}
                      </div>
                    )}
                    {payment && (() => {
                      const status = payment.status?.toLowerCase();
                      const isPaid = status === 'pago' || status === 'conciliado';
                      const isCancelled = status === 'cancelado';
                      const isRefunded = status === 'estornado';
                      const isFailed = status === 'falha';
                      
                      const canEdit = !isCancelled && !isRefunded && !isFailed;
                      
                      if (!canEdit) return null;
                      
                      return (
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-200/50 mt-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); setUpdatePaymentModal({ isOpen: true, paymentId: payment.id, currentAmount: payment.valor, newValue: payment.valor?.toFixed(2) || '0.00', updateFuture: true }); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg transition-all text-[10px] font-bold uppercase border border-amber-100 shadow-sm flex-1 justify-center"
                            title="Editar Valor"
                          >
                            <Edit2 size={14} /> Editar Valor
                          </button>
                        </div>
                      );
                    })()}

                  </div>
                </div>

              </div>

              {/* Histórico de Recebimentos */}
              {e.pagamentos && e.pagamentos.length > 0 && (
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <DollarSign size={14} className="text-slate-400" />
                    Histórico de Recebimentos
                  </h4>
                  <div className="max-h-48 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                    {[...(e.pagamentos || [])].sort((a: any, b: any) => {
                      const dateA = new Date(a.data_pagamento || a.created_at || 0).getTime();
                      const dateB = new Date(b.data_pagamento || b.created_at || 0).getTime();
                      return dateB - dateA;
                    }).map((pag: any) => {
                      const pStatus = pag.status?.toLowerCase();
                      const pIsPaid = pStatus === 'pago' || pStatus === 'conciliado';
                      const pIsCancelled = pStatus === 'cancelado';
                      const pIsRefunded = pStatus === 'estornado';
                      const pIsFailed = pStatus === 'falha';
                      
                      const pCanCancel = !pIsPaid && !pIsCancelled && !pIsRefunded && !pIsFailed;
                      const pCanRefund = pIsPaid;
                      
                      return (
                        <div key={pag.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-100">
                              <CreditCard size={16} className={pIsPaid ? "text-emerald-500" : pIsCancelled || pIsFailed || pIsRefunded ? "text-slate-400" : "text-amber-500"} />
                            </div>
                            <div>
                              <div className="text-sm font-bold text-slate-700">R$ {pag.valor?.toFixed(2).replace('.', ',')}</div>
                              <div className="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1.5">
                                {pag.data_pagamento ? formatDateDisplay(pag.data_pagamento) : (pag.vencimento ? formatDateDisplay(pag.vencimento) : '—')}
                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                {getPaymentMethodLabel(pag.metodo_pagamento)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                              pIsPaid ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : pIsCancelled || pIsRefunded ? 'bg-slate-100 text-slate-500 border border-slate-200'
                                : pIsFailed ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                : 'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}>
                              {pStatus}
                            </span>
                            
                            {pCanRefund && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setRefundPaymentModal({ isOpen: true, paymentId: pag.id, amount: '', isTotal: true }); }}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-all border border-blue-100 shadow-sm text-[10px] font-bold uppercase"
                                title="Estornar Pagamento"
                              >
                                <RefreshCw size={12} /> Estornar
                              </button>
                            )}
                            {pCanCancel && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setCancelPaymentModal({ isOpen: true, paymentId: pag.id }); }}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-all border border-red-100 shadow-sm text-[10px] font-bold uppercase"
                                title="Cancelar Pagamento"
                              >
                                <Trash2 size={12} /> Cancelar
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action buttons footer */}
              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button 
                  onClick={() => setDetailModal({ isOpen: false, enrollment: null })} 
                  className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors"
                >
                  Fechar
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {refundPaymentModal.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-blue-50">
              <h3 className="text-lg font-bold text-blue-900 flex items-center gap-2">
                <RefreshCw size={20} className="text-blue-600" /> Estornar Pagamento
              </h3>
              <button onClick={() => setRefundPaymentModal({ isOpen: false, paymentId: '', amount: '', isTotal: true })} className="p-2 hover:bg-blue-100 rounded-full transition-colors">
                <X size={20} className="text-blue-400" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="flex gap-4">
                  <button onClick={() => setRefundPaymentModal({...refundPaymentModal, isTotal: true})} className={`flex-1 py-3 rounded-xl border font-bold transition-all ${refundPaymentModal.isTotal ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                    Estorno Total
                  </button>
                  <button onClick={() => setRefundPaymentModal({...refundPaymentModal, isTotal: false})} className={`flex-1 py-3 rounded-xl border font-bold transition-all ${!refundPaymentModal.isTotal ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                    Parcial
                  </button>
                </div>
                {!refundPaymentModal.isTotal && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Valor do Estorno (R$)</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</div>
                      <input type="text" className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-lg" placeholder="0,00" value={refundPaymentModal.amount} onChange={e => setRefundPaymentModal({...refundPaymentModal, amount: e.target.value})} />
                    </div>
                  </div>
                )}
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3">
                <Info className="text-blue-600 shrink-0" size={20} />
                <p className="text-xs text-blue-800 leading-relaxed">
                  Deseja realmente realizar o estorno <strong>{refundPaymentModal.isTotal ? 'TOTAL' : `de R$ ${refundPaymentModal.amount || '0,00'}`}</strong> deste pagamento?
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setRefundPaymentModal({ isOpen: false, paymentId: '', amount: '', isTotal: true })} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all">Cancelar</button>
                <button onClick={confirmRefundPayment} disabled={loadingAction} className="flex-1 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 flex items-center justify-center gap-2">
                  {loadingAction ? <RefreshCw className="animate-spin" size={20} /> : 'Confirmar Estorno'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {updatePaymentModal.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-amber-50">
              <h3 className="text-lg font-bold text-amber-900 flex items-center gap-2">
                <Edit2 size={20} className="text-amber-600" /> Editar Valor do Pagamento
              </h3>
              <button onClick={() => setUpdatePaymentModal({ isOpen: false, paymentId: '', currentAmount: 0, newValue: '', updateFuture: false })} className="p-2 hover:bg-amber-100 rounded-full transition-colors">
                <X size={20} className="text-amber-400" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Novo Valor (R$)</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</div>
                  <input type="text" className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none transition-all font-bold text-lg" placeholder="0,00" value={updatePaymentModal.newValue} onChange={e => setUpdatePaymentModal({...updatePaymentModal, newValue: e.target.value})} />
                </div>
              </div>
              <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <input type="checkbox" className="w-5 h-5 text-amber-500 rounded border-slate-300 focus:ring-amber-500 cursor-pointer" checked={updatePaymentModal.updateFuture} onChange={e => setUpdatePaymentModal({...updatePaymentModal, updateFuture: e.target.checked})} />
                <span className="text-xs font-semibold text-slate-700">Atualizar também as próximas parcelas e a assinatura no Pagar.me</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setUpdatePaymentModal({ isOpen: false, paymentId: '', currentAmount: 0, newValue: '', updateFuture: false })} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all">Cancelar</button>
                <button onClick={confirmUpdatePaymentValue} disabled={loadingAction} className="flex-1 py-4 bg-amber-500 text-white font-bold rounded-2xl hover:bg-amber-600 transition-all shadow-lg shadow-amber-200 disabled:opacity-50 flex items-center justify-center gap-2">
                  {loadingAction ? <RefreshCw className="animate-spin" size={20} /> : 'Salvar Alteração'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {cancelPaymentModal.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-rose-50">
              <h3 className="text-lg font-bold text-rose-900 flex items-center gap-2">
                <Trash2 size={20} className="text-rose-600" /> Cancelar Cobrança
              </h3>
              <button onClick={() => setCancelPaymentModal({ isOpen: false, paymentId: '' })} className="p-2 hover:bg-rose-100 rounded-full transition-colors">
                <X size={20} className="text-rose-400" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex gap-3">
                <Info className="text-rose-600 shrink-0" size={20} />
                <p className="text-sm text-rose-800 leading-relaxed">
                  Deseja realmente <strong>cancelar</strong> esta cobrança? Esta ação não pode ser desfeita.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setCancelPaymentModal({ isOpen: false, paymentId: '' })} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all">Manter Cobrança</button>
                <button onClick={confirmCancelPayment} disabled={loadingAction} className="flex-1 py-4 bg-rose-600 text-white font-bold rounded-2xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 disabled:opacity-50 flex items-center justify-center gap-2">
                  {loadingAction ? <RefreshCw className="animate-spin" size={20} /> : 'Confirmar Cancelamento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
