import React from 'react';
import { X, User, Phone, MapPin, Calendar, Clock, CreditCard, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface InscricaoDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  inscricao: any;
}

export default function InscricaoDetailsModal({ isOpen, onClose, inscricao }: InscricaoDetailsModalProps) {
  if (!isOpen || !inscricao) return null;

  const dataString = inscricao.created_at ? new Date(inscricao.created_at).toLocaleString('pt-BR') : 'Data não registrada';
  const phoneNum = inscricao.whatsapp_responsavel || inscricao.telefone_responsavel || inscricao.respostas_personalizadas?.['WhatsApp do Responsável'];

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
              <h3 className="text-2xl font-black uppercase tracking-tight">Detalhes da Inscrição</h3>
              <p className="text-indigo-100 text-[10px] font-black uppercase tracking-widest mt-1">
                ID: {inscricao.id}
              </p>
            </div>
            <button 
              onClick={onClose} 
              className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-10 flex-1 overflow-y-auto custom-scrollbar space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <User size={14} /> Estudante
                </h4>
                <div>
                  <p className="text-lg font-black text-slate-800 uppercase">{inscricao.nome_aluno || 'Não informado'}</p>
                  <p className="text-xs text-slate-500 font-medium">Categoria: {inscricao.categoria || 'Geral'}</p>
                  {inscricao.faixa && <p className="text-xs text-slate-500 font-medium">Faixa: {inscricao.faixa}</p>}
                  {inscricao.tamanho_camisa && <p className="text-xs text-slate-500 font-medium">Camisa: {inscricao.tamanho_camisa}</p>}
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <User size={14} /> Responsável
                </h4>
                <div>
                  <p className="text-lg font-black text-slate-800 uppercase">{inscricao.nome_responsavel || 'Não informado'}</p>
                  <p className="text-xs text-slate-500 font-medium">{inscricao.cpf_responsavel ? `CPF: ${inscricao.cpf_responsavel}` : ''}</p>
                  <p className="text-xs text-slate-500 font-medium mt-2 flex items-center gap-1">
                    <Phone size={12} /> {phoneNum || 'Sem telefone'}
                  </p>
                  {phoneNum && (
                    <div className="mt-3">
                      <a
                        href={`https://wa.me/55${phoneNum.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${(inscricao.nome_responsavel || 'Responsável').split(' ')[0]}, tudo bem?`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-xs font-bold transition-colors"
                      >
                        <MessageCircle size={14} /> WhatsApp
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4 md:col-span-2">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Clock size={14} /> Status e Informações
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  {inscricao.respostas_personalizadas && Object.entries(inscricao.respostas_personalizadas).map(([k, v]) => {
                    // Ignora chaves vazias ou que já foram extraídas explicitamente
                    if (!k || k === 'WhatsApp do Responsável') return null;
                    return (
                      <div key={k} className="col-span-2 md:col-span-1">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{k}</p>
                        <p className="text-sm font-semibold text-slate-700">{v as React.ReactNode}</p>
                      </div>
                    );
                  })}
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Data de Inscrição</p>
                    <p className="text-sm font-semibold text-slate-700">{dataString}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Check-in</p>
                    <p className={`text-sm font-black uppercase ${inscricao.checkin ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {inscricao.checkin ? 'Presente' : 'Ausente'}
                    </p>
                  </div>
                  {inscricao.eventos?.nome && (
                    <div className="col-span-2">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Evento Associado</p>
                      <p className="text-sm font-semibold text-indigo-600 uppercase">{inscricao.eventos.nome}</p>
                    </div>
                  )}
                  {inscricao.valor_pago && (
                    <div className="col-span-2">
                      <p className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                        <CreditCard size={12} /> Pagamento
                      </p>
                      <p className="text-sm font-bold text-slate-700">R$ {inscricao.valor_pago}</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
