import re

with open('src/components/admin/courses/InscricoesTab.tsx', 'r') as f:
    content = f.read()

if "import { createPortal }" not in content:
    content = content.replace("import React, { useState } from 'react';", "import React, { useState } from 'react';\nimport { createPortal } from 'react-dom';")

modals_replacement = """
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
"""

pattern = r'\{\/\* MODAL DE DETALHES \*\/\}[\s\S]*?\{\/\* MODAL DE EDIÇÃO \*\/\}[\s\S]*?(?=\{\/\* MAIN CONTENT \*\/|\<div className="space-y-4"\>)'
content = re.sub(pattern, modals_replacement + "\n      ", content)

with open('src/components/admin/courses/InscricoesTab.tsx', 'w') as f:
    f.write(content)

print("Modals added.")
