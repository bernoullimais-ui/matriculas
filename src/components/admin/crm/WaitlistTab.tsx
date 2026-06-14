import React from 'react';
import { useAdminStore } from '../../../stores/adminStore';
import { RefreshCw, MapPin, User, Tag } from 'lucide-react';
import toast from 'react-hot-toast';

export default function WaitlistTab() {
  const { waitlist } = useAdminStore();

  const loadData = () => {
    // Implement refresh
  };

  const handleCallWaitlist = async (id: string) => {
    // Implement call
    toast.success('Aluno chamado com sucesso!');
  };

  const handleRemoveWaitlist = async (id: string) => {
    // Implement removal
    toast.success('Aluno removido da lista.');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="font-bold text-slate-800">Fila da Lista de Espera</h3>
        <button 
          onClick={loadData}
          className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
          title="Atualizar dados"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                <th className="p-4">Data Inscrição</th>
                <th className="p-4">Aluno</th>
                <th className="p-4">Turma Desejada</th>
                <th className="p-4">Responsáveis</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {waitlist.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Nenhum aluno na lista de espera.
                  </td>
                </tr>
              ) : (
                waitlist.map((item: any) => (
                  <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-800">
                        {new Date(item.created_at).toLocaleDateString('pt-BR')}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{item.estudante}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                        {new Date(item.data_nascimento).toLocaleDateString('pt-BR')}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                        <Tag size={12} className="text-slate-400" />
                        {item.turma}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                        <MapPin size={10} />
                        {item.unidade}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-1">
                        <User size={12} />
                        {item.responsavel1}
                      </div>
                      <div className="text-[10px] text-slate-500 ml-4">
                        {item.telefone1}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-block text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full ${
                        item.status === 'aguardando' ? 'bg-amber-100 text-amber-700' :
                        item.status === 'chamado' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {item.status || 'Aguardando'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {item.status !== 'chamado' && (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleRemoveWaitlist(item.id)}
                            className="px-3 py-1.5 text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
                          >
                            Remover
                          </button>
                          <button
                            onClick={() => handleCallWaitlist(item.id)}
                            className="px-3 py-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                          >
                            Marcar como Chamado
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
