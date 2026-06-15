import React from 'react';
import { useModalStore } from '../../../stores/modalStore';

interface CancelModalProps {
  loadingAction: boolean;
  executeCancelEnrollment: () => void;
}

export function CancelModal({ loadingAction, executeCancelEnrollment }: CancelModalProps) {
  const { cancelModal, setCancelModal } = useModalStore();

  if (!cancelModal.isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded-3xl max-w-sm w-full border border-slate-200 shadow-xl space-y-4">
        <h3 className="font-bold text-slate-800 text-lg">Cancelar Matrícula</h3>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Efetiva</label>
          <input 
            type="date" 
            value={cancelModal.date} 
            onChange={e => setCancelModal({ date: e.target.value })} 
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" 
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Justificativa</label>
          <textarea 
            value={cancelModal.reason} 
            onChange={e => setCancelModal({ reason: e.target.value })} 
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm h-20" 
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button 
            onClick={() => setCancelModal({ isOpen: false, enrollmentId: null, reason: '', date: '' })} 
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-50"
          >
            Fechar
          </button>
          <button 
            onClick={executeCancelEnrollment} 
            disabled={loadingAction} 
            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold"
          >
            {loadingAction ? 'Processando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
