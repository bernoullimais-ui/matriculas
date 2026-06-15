import React from 'react';
import { Trash2, X, Info, RefreshCw } from 'lucide-react';
import { useModalStore } from '../../../stores/modalStore';

interface CancelPaymentModalProps {
  loadingAction: boolean;
  confirmCancelPayment: () => void;
}

export function CancelPaymentModal({ loadingAction, confirmCancelPayment }: CancelPaymentModalProps) {
  const { cancelPaymentModal, setCancelPaymentModal } = useModalStore();

  if (!cancelPaymentModal.isOpen) return null;

  return (
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
            <button 
              onClick={() => setCancelPaymentModal({ isOpen: false, paymentId: '' })} 
              className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
            >
              Manter Cobrança
            </button>
            <button 
              onClick={confirmCancelPayment} 
              disabled={loadingAction} 
              className="flex-1 py-4 bg-rose-600 text-white font-bold rounded-2xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loadingAction ? <RefreshCw className="animate-spin" size={20} /> : 'Confirmar Cancelamento'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
