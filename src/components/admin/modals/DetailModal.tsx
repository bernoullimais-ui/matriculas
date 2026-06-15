import React from 'react';
import { Users, Mail, Phone, CreditCard, DollarSign, RefreshCw, Trash2, Edit2, XCircle } from 'lucide-react';
import { useModalStore } from '../../../stores/modalStore';
import { formatDateDisplay } from '../../../utils/dateUtils';

export function DetailModal() {
  const { 
    detailModal, 
    setDetailModal, 
    setUpdatePaymentModal, 
    setRefundPaymentModal, 
    setCancelPaymentModal 
  } = useModalStore();

  if (!detailModal.isOpen || !detailModal.enrollment) return null;

  const e = detailModal.enrollment;
  const payment = e.pagamentos?.find((p: any) => p.matricula_id === e.matricula.id);
  
  const getPaymentMethodLabel = (method: string) => {
    if (!method) return 'N/A';
    if (method.includes('credit_card')) return 'Cartão de Crédito';
    if (method.includes('pix')) return 'PIX';
    if (method.includes('boleto')) return 'Boleto';
    return method;
  };

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
                      onClick={(evt) => { evt.stopPropagation(); setUpdatePaymentModal({ isOpen: true, paymentId: payment.id, currentAmount: payment.valor, newValue: payment.valor?.toFixed(2) || '0.00', updateFuture: true }); }}
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
                          onClick={(evt) => { evt.stopPropagation(); setRefundPaymentModal({ isOpen: true, paymentId: pag.id, amount: '', isTotal: true }); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-all border border-blue-100 shadow-sm text-[10px] font-bold uppercase"
                          title="Estornar Pagamento"
                        >
                          <RefreshCw size={12} /> Estornar
                        </button>
                      )}
                      {pCanCancel && (
                        <button
                          onClick={(evt) => { evt.stopPropagation(); setCancelPaymentModal({ isOpen: true, paymentId: pag.id }); }}
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
}
