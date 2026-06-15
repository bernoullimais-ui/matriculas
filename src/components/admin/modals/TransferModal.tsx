import React from 'react';
import { Truck } from 'lucide-react';
import { useModalStore } from '../../../stores/modalStore';

interface TransferModalProps {
  activeEnrollment: any;
  options: any;
  filteredTurmas: any[];
  loadingAction: boolean;
  executeTransferEnrollment: () => void;
}

export function TransferModal({
  activeEnrollment,
  options,
  filteredTurmas,
  loadingAction,
  executeTransferEnrollment
}: TransferModalProps) {
  const { transferModal, setTransferModal } = useModalStore();

  if (!transferModal.isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded-3xl max-w-sm w-full border border-slate-200 shadow-xl space-y-4">
        
        {/* Header */}
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
            onChange={e => setTransferModal({ targetUnidade: e.target.value, targetTurma: '' })} 
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-700"
          >
            <option value="">Selecione a unidade...</option>
            {(options?.unidades || []).map((u: any) => (
              <option key={u.id || u.nome || u} value={u.nome || u}>{u.nome || u}</option>
            ))}
          </select>
        </div>

        {/* Nova Turma Dropdown */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nova Turma</label>
          <select 
            disabled={!transferModal.targetUnidade}
            value={transferModal.targetTurma} 
            onChange={e => setTransferModal({ targetTurma: e.target.value })} 
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-700 disabled:opacity-50"
          >
            <option value="">Selecione a turma...</option>
            {filteredTurmas.map((t: any) => (
              <option key={t.id} value={t.nome}>{t.nome}</option>
            ))}
          </select>
        </div>

        {/* Actions */}
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
}
