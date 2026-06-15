import React from 'react';
import { useModalStore } from '../../../stores/modalStore';

interface EditStudentModalProps {
  options: any;
  loadingAction: boolean;
  executeEditStudent: () => void;
}

export function EditStudentModal({ options, loadingAction, executeEditStudent }: EditStudentModalProps) {
  const { editStudentModal, setEditStudentModal } = useModalStore();

  if (!editStudentModal.isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded-3xl max-w-sm w-full border border-slate-200 shadow-xl space-y-4">
        <h3 className="font-bold text-slate-800 text-lg">Editar Aluno</h3>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
          <input 
            type="text" 
            value={editStudentModal.nome_completo} 
            onChange={e => setEditStudentModal({ nome_completo: e.target.value })} 
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" 
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unidade de Vínculo</label>
          <select 
            value={editStudentModal.unidade_origem_id} 
            onChange={e => setEditStudentModal({ unidade_origem_id: e.target.value })} 
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
          >
            <option value="">Nenhuma / Sem Vínculo</option>
            {options.unidades?.map((u: any) => (
              <option key={u.id || u.nome || u} value={u.id || u.nome || u}>{u.nome || u}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 pt-2">
          <button 
            onClick={() => setEditStudentModal({ isOpen: false, studentId: null, nome_completo: '', unidade_origem_id: '' })} 
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-50"
          >
            Fechar
          </button>
          <button 
            onClick={executeEditStudent} 
            disabled={loadingAction} 
            className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold"
          >
            {loadingAction ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
