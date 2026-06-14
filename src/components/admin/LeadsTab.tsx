import React from 'react';
import { formatDateDisplay } from '../../utils/dateUtils';

import { useAdminStore } from '../../stores/adminStore';

export function LeadsTab() {
  const { leads, setLeads } = useAdminStore();
  const [leadWhatsAppModal, setLeadWhatsAppModal] = React.useState<{ isOpen: boolean, lead: any | null, message: string, isSending?: boolean }>({ isOpen: false, lead: null, message: '' });
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Leads (Fale Conosco)</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Gerencie os contatos recebidos pelo website.</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Nome</th>
                <th className="px-6 py-4">Contato</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    Nenhum lead recebido ainda.
                  </td>
                </tr>
              ) : (
                leads.map((lead: any) => (
                  <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {formatDateDisplay(lead.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900">
                      {lead.nome}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap space-y-1">
                      <div className="text-sm">{lead.email}</div>
                      <div className="text-xs text-slate-500">{lead.whatsapp}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={lead.status || 'novo'}
                        onChange={async (e) => {
                          const newStatus = e.target.value;
                          try {
                            const res = await fetch(`/api/admin/leads/${lead.id}`, {
                              method: 'PATCH',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${sessionStorage.getItem('admin_token')}`
                              },
                              body: JSON.stringify({ status: newStatus })
                            });
                            if (res.ok) {
                              setLeads(leads.map((l: any) => l.id === lead.id ? { ...l, status: newStatus } : l));
                            }
                          } catch (err) {
                            console.error('Error updating lead status', err);
                          }
                        }}
                        className={`text-xs font-bold px-3 py-1.5 rounded-full outline-none border ${
                          lead.status === 'convertido' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          lead.status === 'em_atendimento' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        <option value="novo">Novo</option>
                        <option value="em_atendimento">Em Atendimento</option>
                        <option value="convertido">Convertido</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => setLeadWhatsAppModal({ 
                          isOpen: true, 
                          lead, 
                          message: `Olá ${lead.nome}, recebemos seu contato no site da Sport For Kids.` 
                        })}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-xs font-bold transition-colors"
                      >
                        WhatsApp
                      </button>
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
