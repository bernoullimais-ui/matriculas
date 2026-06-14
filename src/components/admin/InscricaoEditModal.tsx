import React, { useState, useEffect } from 'react';
import { X, Save, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

interface InscricaoEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  inscricao: any;
  onSuccess: () => void;
}

export default function InscricaoEditModal({ isOpen, onClose, inscricao, onSuccess }: InscricaoEditModalProps) {
  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (inscricao) {
      setFormData({
        nome_aluno: inscricao.nome_aluno || '',
        nome_responsavel: inscricao.nome_responsavel || '',
        whatsapp_responsavel: inscricao.whatsapp_responsavel || inscricao.telefone_responsavel || inscricao.respostas_personalizadas?.['WhatsApp do Responsável'] || '',
        categoria: inscricao.categoria || '',
        faixa: inscricao.faixa || inscricao.respostas_personalizadas?.['Qual a faixa atual do estudante'] || inscricao.respostas_personalizadas?.['Faixa'] || '',
        tamanho_camisa: inscricao.tamanho_camisa || inscricao.respostas_personalizadas?.['Tamanho da Camisa'] || '',
      });
    }
  }, [inscricao]);

  if (!isOpen || !inscricao) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = sessionStorage.getItem('admin_token');

      const respostasAtualizadas = { ...inscricao.respostas_personalizadas };
      if (formData.whatsapp_responsavel) respostasAtualizadas['WhatsApp do Responsável'] = formData.whatsapp_responsavel;
      if (formData.faixa) {
        if (respostasAtualizadas['Qual a faixa atual do estudante']) {
          respostasAtualizadas['Qual a faixa atual do estudante'] = formData.faixa;
        } else {
          respostasAtualizadas['Faixa'] = formData.faixa;
        }
      }
      if (formData.tamanho_camisa) respostasAtualizadas['Tamanho da Camisa'] = formData.tamanho_camisa;

      const payload = {
        nome_aluno: formData.nome_aluno,
        nome_responsavel: formData.nome_responsavel,
        categoria: formData.categoria,
        respostas_personalizadas: respostasAtualizadas
      };

      const res = await fetch(`/api/admin/eventos/inscricoes/${inscricao.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao atualizar inscrição');
      }
      
      toast.success('Inscrição atualizada com sucesso!');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar inscrição');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="p-8 bg-indigo-600 text-white flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-2xl font-black uppercase tracking-tight">Editar Inscrição</h3>
            </div>
            <button 
              onClick={onClose} 
              className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-10 flex-1 overflow-y-auto custom-scrollbar space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Nome do Aluno</label>
                <input
                  type="text"
                  value={formData.nome_aluno}
                  onChange={e => setFormData({ ...formData, nome_aluno: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Categoria</label>
                <input
                  type="text"
                  value={formData.categoria}
                  onChange={e => setFormData({ ...formData, categoria: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Nome do Responsável</label>
                <input
                  type="text"
                  value={formData.nome_responsavel}
                  onChange={e => setFormData({ ...formData, nome_responsavel: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">WhatsApp Responsável</label>
                <input
                  type="text"
                  value={formData.whatsapp_responsavel}
                  onChange={e => setFormData({ ...formData, whatsapp_responsavel: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Faixa</label>
                <input
                  type="text"
                  value={formData.faixa}
                  onChange={e => setFormData({ ...formData, faixa: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Tamanho Camisa</label>
                <input
                  type="text"
                  value={formData.tamanho_camisa}
                  onChange={e => setFormData({ ...formData, tamanho_camisa: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
                />
              </div>
            </div>

            <div className="pt-6">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl transition-all disabled:opacity-50"
              >
                {loading ? <Loader className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {loading ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
