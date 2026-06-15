import React from 'react';
import { RefreshCw, X, Info } from 'lucide-react';
import { useModalStore } from '../../../stores/modalStore';

interface RefundPaymentModalProps {
  loadingAction: boolean;
  confirmRefundPayment: () => void;
}

export function RefundPaymentModal({ loadingAction, confirmRefundPayment }: RefundPaymentModalProps) {
  const { refundPaymentModal, setRefundPaymentModal } = useModalStore();

  if (!refundPaymentModal.isOpen) return null;

  return (
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
              <button 
                onClick={() => setRefundPaymentModal({ isTotal: true })} 
                className={`flex-1 py-3 rounded-xl border font-bold transition-all ${refundPaymentModal.isTotal ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
              >
                Estorno Total
              </button>
              <button 
                onClick={() => setRefundPaymentModal({ isTotal: false })} 
                className={`flex-1 py-3 rounded-xl border font-bold transition-all ${!refundPaymentModal.isTotal ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
              >
                Parcial
              </button>
            </div>
            {!refundPaymentModal.isTotal && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Valor do Estorno (R$)</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</div>
                  <input 
                    type="text" 
                    className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-lg" 
                    placeholder="0,00" 
                    value={refundPaymentModal.amount} 
                    onChange={e => setRefundPaymentModal({ amount: e.target.value })} 
                  />
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
            <button 
              onClick={() => setRefundPaymentModal({ isOpen: false, paymentId: '', amount: '', isTotal: true })} 
              className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
            >
              Cancelar
            </button>
            <button 
              onClick={confirmRefundPayment} 
              disabled={loadingAction} 
              className="flex-1 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loadingAction ? <RefreshCw className="animate-spin" size={20} /> : 'Confirmar Estorno'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
