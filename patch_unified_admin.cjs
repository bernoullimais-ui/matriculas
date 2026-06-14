const fs = require('fs');

const path = 'src/pages/Admin/UnifiedAdmin.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add States
const stateAnchor = `  const [detailModal, setDetailModal] = useState<{ isOpen: boolean, enrollment: any | null }>({
    isOpen: false, enrollment: null
  });`;

const stateReplacement = stateAnchor + `
  const [refundPaymentModal, setRefundPaymentModal] = useState<{ isOpen: boolean, paymentId: string, amount: string, isTotal: boolean }>({ isOpen: false, paymentId: '', amount: '', isTotal: true });
  const [updatePaymentModal, setUpdatePaymentModal] = useState<{ isOpen: boolean, paymentId: string, currentAmount: number, newValue: string, updateFuture: boolean }>({ isOpen: false, paymentId: '', currentAmount: 0, newValue: '', updateFuture: false });
  const [cancelPaymentModal, setCancelPaymentModal] = useState<{ isOpen: boolean, paymentId: string }>({ isOpen: false, paymentId: '' });
`;

content = content.replace(stateAnchor, stateReplacement);

// 2. Add Functions
const funcAnchor = `  const handleImpersonate = async (guardianId: string) => {`;
const funcReplacement = `
  const confirmRefundPayment = async () => {
    const { paymentId, amount: amountStr, isTotal } = refundPaymentModal;
    const amount = !isTotal && amountStr.trim() ? parseFloat(amountStr.replace(',', '.')) : null;
    if (!isTotal && amountStr.trim() && isNaN(amount as number)) {
      toast.error('Valor inválido.');
      return;
    }
    setLoadingAction(true);
    try {
      const response = await fetch(\`/api/payments/refund/\${paymentId}\`, {
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
        toast.error(\`Erro ao estornar: \${data.error}\`);
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
      const response = await fetch(\`/api/payments/\${paymentId}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor: newValue })
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
      toast.error('Erro de conexão ao atualizar valor.');
    } finally {
      setLoadingAction(false);
    }
  };

  const confirmCancelPayment = async () => {
    setLoadingAction(true);
    try {
      const response = await fetch(\`/api/payments/cancel/\${cancelPaymentModal.paymentId}\`, {
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

` + funcAnchor;

content = content.replace(funcAnchor, funcReplacement);

// 3. Add Action Buttons inside detailModal Payment Card
const paymentCardAnchor = `{payment?.pagarme && (
                      <div className="text-[10px] text-slate-400 break-all pt-1 border-t border-slate-200/50">
                        ID: {payment.pagarme}
                      </div>
                    )}`;

const paymentCardReplacement = paymentCardAnchor + `
                    {payment && (() => {
                      const status = payment.status?.toLowerCase();
                      const isPaid = status === 'pago' || status === 'conciliado';
                      const isCancelled = status === 'cancelado';
                      const isRefunded = status === 'estornado';
                      const isFailed = status === 'falha';
                      
                      const canCancel = !isPaid && !isCancelled && !isRefunded && !isFailed;
                      const canRefund = isPaid;
                      const canEdit = !isPaid && !isCancelled && !isRefunded && !isFailed;
                      
                      if (!canCancel && !canRefund && !canEdit) return null;
                      
                      return (
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-200/50 mt-2">
                          {canEdit && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setUpdatePaymentModal({ isOpen: true, paymentId: payment.id, currentAmount: payment.valor, newValue: payment.valor?.toFixed(2) || '0.00', updateFuture: false }); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg transition-all text-[10px] font-bold uppercase border border-amber-100 shadow-sm flex-1 justify-center"
                              title="Editar Valor"
                            >
                              <Edit3 size={14} /> Editar Valor
                            </button>
                          )}
                          {canCancel && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setCancelPaymentModal({ isOpen: true, paymentId: payment.id }); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-all text-[10px] font-bold uppercase border border-red-100 shadow-sm flex-1 justify-center"
                              title="Cancelar Pagamento"
                            >
                              <Trash2 size={14} /> Cancelar
                            </button>
                          )}
                          {canRefund && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setRefundPaymentModal({ isOpen: true, paymentId: payment.id, amount: '', isTotal: true }); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-all text-[10px] font-bold uppercase border border-blue-100 shadow-sm flex-1 justify-center"
                              title="Estornar Pagamento"
                            >
                              <RefreshCw size={14} /> Estornar
                            </button>
                          )}
                        </div>
                      );
                    })()}
`;

content = content.replace(paymentCardAnchor, paymentCardReplacement);

// 4. Add the Modals JSX right before the end of the file.
const modalsAnchor = `    </div>
  );
}`;

const modalsReplacement = `
      {/* Modal Estornar Pagamento */}
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
                  <button onClick={() => setRefundPaymentModal({...refundPaymentModal, isTotal: true})} className={\`flex-1 py-3 rounded-xl border font-bold transition-all \${refundPaymentModal.isTotal ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}\`}>
                    Estorno Total
                  </button>
                  <button onClick={() => setRefundPaymentModal({...refundPaymentModal, isTotal: false})} className={\`flex-1 py-3 rounded-xl border font-bold transition-all \${!refundPaymentModal.isTotal ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}\`}>
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
                  Deseja realmente realizar o estorno <strong>{refundPaymentModal.isTotal ? 'TOTAL' : \`de R$ \${refundPaymentModal.amount || '0,00'}\`}</strong> deste pagamento?
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

      {/* Modal Editar Valor do Pagamento */}
      {updatePaymentModal.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-amber-50">
              <h3 className="text-lg font-bold text-amber-900 flex items-center gap-2">
                <Edit3 size={20} className="text-amber-600" /> Editar Valor do Pagamento
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

      {/* Modal Cancelar Pagamento */}
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
` + modalsAnchor;

content = content.replace(modalsAnchor, modalsReplacement);

fs.writeFileSync(path, content);
