import React from 'react';
import { Edit2, X, RefreshCw } from 'lucide-react';
import { useModalStore } from '../../../stores/modalStore';

interface UpdatePaymentModalProps {
  loadingAction: boolean;
  confirmUpdatePaymentValue: () => void;
}

export function UpdatePaymentModal({ loadingAction, confirmUpdatePaymentValue }: UpdatePaymentModalProps) {
  const { updatePaymentModal, setUpdatePaymentModal } = useModalStore();

  if (!updatePaymentModal.isOpen) return null;

  return (
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
              <input 
                type="text" 
                className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none transition-all font-bold text-lg" 
                placeholder="0,00" 
                value={updatePaymentModal.newValue} 
                onChange={e => setUpdatePaymentModal({ newValue: e.target.value })} 
              />
            </div>
          </div>
          <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
            <input 
              type="checkbox" 
              className="w-5 h-5 text-amber-500 rounded border-slate-300 focus:ring-amber-500 cursor-pointer" 
              checked={updatePaymentModal.updateFuture} 
              onChange={e => setUpdatePaymentModal({ updateFuture: e.target.checked })} 
            />
            <span className="text-xs font-semibold text-slate-700">Atualizar também as próximas parcelas e a assinatura no Pagar.me</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button 
              onClick={() => setUpdatePaymentModal({ isOpen: false, paymentId: '', currentAmount: 0, newValue: '', updateFuture: false })} 
              className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
            >
              Cancelar
            </button>
            <button 
              onClick={confirmUpdatePaymentValue} 
              disabled={loadingAction} 
              className="flex-1 py-4 bg-amber-500 text-white font-bold rounded-2xl hover:bg-amber-600 transition-all shadow-lg shadow-amber-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loadingAction ? <RefreshCw className="animate-spin" size={20} /> : 'Salvar Alteração'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
