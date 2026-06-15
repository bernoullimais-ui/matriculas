import React from 'react';
import { useModalStore } from '../../../stores/modalStore';

interface FreezeModalProps {
  loadingAction: boolean;
  executeFreezeEnrollment: () => void;
}

export function FreezeModal({ loadingAction, executeFreezeEnrollment }: FreezeModalProps) {
  const { freezeModal, setFreezeModal } = useModalStore();

  if (!freezeModal.isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded-3xl max-w-sm w-full border border-slate-200 shadow-xl space-y-4">
        <h3 className="font-bold text-slate-800 text-lg">Trancar Matrícula</h3>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data de Início</label>
          <input 
            type="date" 
            value={freezeModal.startDate} 
            onChange={e => setFreezeModal({ startDate: e.target.value })} 
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" 
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Prevista de Retorno</label>
          <input 
            type="date" 
            value={freezeModal.endDate} 
            onChange={e => setFreezeModal({ endDate: e.target.value })} 
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" 
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button 
            onClick={() => setFreezeModal({ isOpen: false, enrollmentId: null, startDate: '', endDate: '' })} 
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-50"
          >
            Fechar
          </button>
          <button 
            onClick={executeFreezeEnrollment} 
            disabled={loadingAction} 
            className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold"
          >
            {loadingAction ? 'Processando...' : 'Trancar'}
          </button>
        </div>
      </div>
    </div>
  );
}
