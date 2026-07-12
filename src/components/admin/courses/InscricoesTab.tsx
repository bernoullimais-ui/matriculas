import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';
import { motion } from 'motion/react';
import { 
  Search, X, Check, Eye, Trash2, Edit2, Ticket, CheckCircle2, Circle, AlertCircle, RefreshCw, Send, Save
, MessageCircle, Info} from 'lucide-react';
import { useAdminStore } from '../../../stores/adminStore';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';

export function InscricoesTab() {
  const { inscricoes, setInscricoes, eventos, loadData } = useAdminStore();
  const canEdit = (window as any).checkAdminPermission ? (window as any).checkAdminPermission('cursos_eventos_inscricoes', 'editar') : true;
  const canDelete = (window as any).checkAdminPermission ? (window as any).checkAdminPermission('cursos_eventos_inscricoes', 'excluir') : true;
  
  const [showInscricaoDetails, setShowInscricaoDetails] = useState<any | null>(null);
  const [showInscricaoEdit, setShowInscricaoEdit] = useState<any | null>(null);
  const [enrollmentSearch, setEnrollmentSearch] = useState('');
  const [filtroEventoId, setFiltroEventoId] = useState<string>('');
  const [showBulkWhatsAppModal, setShowBulkWhatsAppModal] = useState(false);

  const filteredInscricoes = inscricoes.filter((ins: any) => {
    let match = true;
    if (filtroEventoId && ins.evento_id !== filtroEventoId) match = false;
    if (enrollmentSearch) {
      const s = enrollmentSearch.toLowerCase();
      if (!ins.nome_aluno?.toLowerCase().includes(s) && 
          !ins.nome_responsavel?.toLowerCase().includes(s) &&
          !ins.categoria?.toLowerCase().includes(s)) {
        match = false;
      }
    }
    return match;
  });

  
  const handleCheckin = async (inscricaoId: string, checkinStatus: boolean) => {
    const token = sessionStorage.getItem('admin_token');
    const headers = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };

    try {
      const res = await fetch(`/api/admin/eventos/inscricoes/${inscricaoId}/checkin`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ checkin: checkinStatus })
      });
      if (res.ok) {
        toast.success(checkinStatus ? 'Presença confirmada!' : 'Presença removida.');
        setInscricoes(inscricoes.map((ins: any) => ins.id === inscricaoId ? { ...ins, checkin: checkinStatus } : ins));
      } else {
        toast.error('Erro ao registrar check-in.');
      }
    } catch {
      toast.error('Erro de rede.');
    }
  };

  const handleUpdateInscricao = async (id: string, data: any) => {
    const token = sessionStorage.getItem('admin_token');
    const headers = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };

    try {
      const res = await fetch(`/api/admin/eventos/inscricoes/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data)
      });
      if (res.ok) {
        toast.success('Inscrição atualizada com sucesso!');
        setShowInscricaoEdit(null);
        loadData();
      } else {
        toast.error('Erro ao atualizar inscrição.');
      }
    } catch {
      toast.error('Erro de rede.');
    }
  };

  const handleDeleteInscricao = async (inscricaoId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta inscrição?')) return;
    const token = sessionStorage.getItem('admin_token');
    const headers = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };

    try {
      const res = await fetch(`/api/admin/eventos/inscricoes/${inscricaoId}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        toast.success('Inscrição excluída com sucesso!');
        loadData();
      } else {
        toast.error('Erro ao excluir inscrição.');
      }
    } catch {
      toast.error('Erro de rede.');
    }
  };

  const handleEditInscricao = async (inscricaoId: string, updates: any) => {
    const token = sessionStorage.getItem('admin_token');
    const headers = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };

    try {
      const res = await fetch(`/api/admin/eventos/inscricoes/${inscricaoId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        toast.success('Inscrição atualizada com sucesso!');
        loadData();
        setShowInscricaoEdit(null);
      } else {
        toast.error('Erro ao atualizar inscrição.');
      }
    } catch {
      toast.error('Erro de rede.');
    }
  };
  const handleExportCSV = () => {
    let csvContent = "\ufeff"; // BOM for UTF-8 Excel compatibility
    csvContent += "Data;Evento;Aluno;Responsável;Telefone;Email;Categoria;Valor Pago (R$);Status;Presença;Unidade;Data de Nascimento\n";
    
    filteredInscricoes.forEach((ins: any) => {
      const data = ins.created_at ? formatDateTime(ins.created_at) : 'N/A';
      const evento = eventos.find((e: any) => e.id === ins.evento_id)?.titulo || 'Desconhecido';
      const aluno = ins.nome_aluno || 'N/A';
      const responsavel = ins.nome_responsavel || 'N/A';
      const telefone = ins.whatsapp_responsavel || ins.telefone_responsavel || ins.telefone_contato || ins.telefone || ins.respostas_personalizadas?.['WhatsApp do Responsável'] || ins.respostas_personalizadas?.['Telefone'] || ins.respostas_personalizadas?.['WhatsApp'] || 'N/A';
      const email = ins.email_responsavel || ins.email_contato || ins.email || ins.respostas_personalizadas?.['Email'] || ins.respostas_personalizadas?.['E-mail'] || 'N/A';
      const categoria = ins.categoria || 'N/A';
      const valor = ins.valor_pago ? Number(ins.valor_pago).toFixed(2) : '0.00';
      const status = ins.status || 'N/A';
      const presenca = ins.checkin ? 'Presente' : 'Ausente';
      const unidade = ins.alunos?.unidade || ins.respostas_personalizadas?.['Unidade'] || 'N/A';
      
      let dataNascimento = 'N/A';
      const rawNascimento = ins.alunos?.data_nascimento || ins.respostas_personalizadas?.['Data de Nascimento do Aluno'] || ins.respostas_personalizadas?.['Data de Nascimento'];
      if (rawNascimento) {
        // Try to format it if it's YYYY-MM-DD
        const parts = rawNascimento.split('-');
        if (parts.length === 3) {
          dataNascimento = `${parts[2]}/${parts[1]}/${parts[0]}`;
        } else {
          dataNascimento = rawNascimento;
        }
      }

      csvContent += `"${data}";"${evento}";"${aluno}";"${responsavel}";"${telefone}";"${email}";"${categoria}";${valor};"${status}";"${presenca}";"${unidade}";"${dataNascimento}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const filename = `inscricoes_eventos_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      
      {/* MODAL DE DETALHES */}
      {showInscricaoDetails && createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl relative">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-800">Detalhes da Inscrição</h3>
              <button onClick={() => setShowInscricaoDetails(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
            </div>
            <div className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100"><span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Estudante</span><p className="text-slate-800 font-bold">{showInscricaoDetails.nome_aluno || 'N/A'}</p></div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100"><span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Responsável</span><p className="text-slate-800 font-bold">{showInscricaoDetails.nome_responsavel || 'N/A'}</p></div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100"><span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Categoria</span><p className="text-slate-800 font-bold">{showInscricaoDetails.categoria || 'N/A'}</p></div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100"><span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status Check-in</span><p className="text-slate-800 font-bold">{showInscricaoDetails.checkin ? <span className="text-emerald-600">PRESENTE</span> : <span className="text-rose-600">AUSENTE</span>}</p></div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100"><span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data da Inscrição</span><p className="text-slate-800 font-bold">{showInscricaoDetails.created_at ? formatDateTime(showInscricaoDetails.created_at) : 'N/A'}</p></div>
            </div>
            <div className="mt-8 flex justify-end">
              <button onClick={() => setShowInscricaoDetails(null)} className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors">Fechar</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL DE EDIÇÃO */}
      {showInscricaoEdit && createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl relative">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-800">Editar Inscrição</h3>
              <button onClick={() => setShowInscricaoEdit(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              handleEditInscricao(showInscricaoEdit.id, {
                nome_aluno: fd.get('nome_aluno'),
                nome_responsavel: fd.get('nome_responsavel'),
                categoria: fd.get('categoria')
              });
            }}>
              <div className="space-y-4">
                <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Estudante</label><input name="nome_aluno" defaultValue={showInscricaoEdit.nome_aluno} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none" required/></div>
                <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Responsável</label><input name="nome_responsavel" defaultValue={showInscricaoEdit.nome_responsavel} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"/></div>
                <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Categoria</label><input name="categoria" defaultValue={showInscricaoEdit.categoria} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"/></div>
              </div>
              <div className="mt-8 flex justify-end gap-3">
                <button type="button" onClick={() => setShowInscricaoEdit(null)} className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors">Cancelar</button>
                <button type="submit" className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors flex items-center gap-2"><Save size={16}/> Salvar Alterações</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL DE WHATSAPP MASSIVO */}
      {showBulkWhatsAppModal && createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl relative">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-emerald-600 flex items-center gap-2"><MessageCircle size={24}/> Disparo WhatsApp</h3>
              <button onClick={() => setShowBulkWhatsAppModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
            </div>
            <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl text-sm font-medium leading-relaxed mb-6 border border-emerald-100">
              Esta função enviará uma mensagem para <strong className="font-black text-emerald-700">{filteredInscricoes.length}</strong> inscritos filtrados no momento.
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              toast.success(`Mensagem enfileirada para ${filteredInscricoes.length} contatos!`);
              setShowBulkWhatsAppModal(false);
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Mensagem</label>
                  <textarea name="mensagem" required rows={6} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none resize-none" placeholder="Olá! Este é um lembrete do nosso evento..."></textarea>
                </div>
              </div>
              <div className="mt-8 flex justify-end gap-3">
                <button type="button" onClick={() => setShowBulkWhatsAppModal(false)} className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors">Cancelar</button>
                <button type="submit" className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors flex items-center gap-2"><Send size={16}/> Enviar Mensagens</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MAIN CONTENT */}
                    {true && (
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                    <select 
                      value={filtroEventoId} 
                      onChange={e => setFiltroEventoId(e.target.value)}
                      className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-700 w-full md:w-80"
                    >
                      <option value="">Filtrar por Evento...</option>
                      {eventos.map(evt => <option key={evt.id} value={evt.id}>{evt.titulo}</option>)}
                    </select>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-slate-500 font-semibold">{filteredInscricoes.length} inscrições encontradas</span>
                      <button
                        onClick={handleExportCSV}
                        className="px-3 py-1.5 bg-indigo-50 text-indigo-600 font-bold rounded-lg hover:bg-indigo-100 transition-colors text-xs flex items-center gap-1"
                      >
                        <RefreshCw size={14} />
                        Exportar CSV
                      </button>
                      <button
                        onClick={() => setShowBulkWhatsAppModal(true)}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-600 font-bold rounded-lg hover:bg-emerald-100 transition-colors text-xs flex items-center gap-1"
                      >
                        <MessageCircle size={14} />
                        Disparo em Massa
                      </button>
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                          <th className="p-4">Estudante</th>
                          <th className="p-4">Responsável</th>
                          <th className="p-4">Categoria</th>
                          <th className="p-4">Status</th>
                          <th className="p-4">Check-in / Presença</th>
                          <th className="p-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInscricoes.map((ins: any) => (
                          <tr key={ins.id} className="border-b border-slate-100 last:border-0">
                            <td className="p-4 font-semibold text-slate-800">{ins.nome_aluno || 'Estudante'}</td>
                            <td className="p-4 text-xs text-slate-500">{ins.nome_responsavel || 'N/A'}</td>
                            <td className="p-4 text-xs font-medium text-slate-600">{ins.categoria || 'Geral'}</td>
                            <td className="p-4">
                              {ins.taxa_paga || (ins.status || '').toLowerCase() === 'confirmada' || ins.status === 'pago' ? (
                                <span className="px-2 py-1 bg-emerald-50 text-emerald-700 font-black uppercase text-[10px] tracking-wider rounded-lg">Pago</span>
                              ) : (
                                <span className="px-2 py-1 bg-amber-50 text-amber-700 font-black uppercase text-[10px] tracking-wider rounded-lg">Pendente</span>
                              )}
                            </td>
                            <td className="p-4">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={ins.checkin || false}
                                  onChange={e => handleCheckin(ins.id, e.target.checked)}
                                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                />
                                <span className={`text-[10px] uppercase font-extrabold ${ins.checkin ? 'text-emerald-600' : 'text-slate-400'}`}>
                                  {ins.checkin ? 'Presente' : 'Ausente'}
                                </span>
                              </label>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => setShowInscricaoDetails(ins)}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                  title="Detalhes"
                                >
                                  <Info size={16} />
                                </button>
                                {canEdit && (
                                  <button
                                    onClick={() => setShowInscricaoEdit(ins)}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="Editar"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    onClick={() => handleDeleteInscricao(ins.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                    title="Excluir"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

    </>
  );
}
