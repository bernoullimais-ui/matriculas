import React, { useState, useRef, useEffect } from 'react';
import { X, Play, Pause, CheckCircle2, AlertCircle, Loader, Upload, File as FileIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

interface BulkWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  inscricoes: any[];
}

export default function BulkWhatsAppModal({ isOpen, onClose, inscricoes }: BulkWhatsAppModalProps) {
  const [message, setMessage] = useState('Olá {{responsavel}}, passando para informar que {{aluno}} está com a inscrição confirmada no evento.');
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, status: '' });
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const runningRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setIsSending(false);
      setProgress({ current: 0, total: inscricoes.length, status: '' });
      runningRef.current = false;
    }
  }, [isOpen, inscricoes]);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.size > 16 * 1024 * 1024) {
        toast.error('O arquivo deve ter no máximo 16MB');
        return;
      }
      setFile(selected);
    }
  };

  const startSending = async () => {
    if (!message.trim()) {
      toast.error('A mensagem não pode estar vazia');
      return;
    }
    
    setIsSending(true);
    runningRef.current = true;
    setProgress({ current: 0, total: inscricoes.length, status: 'Iniciando disparos...' });

    let mediaUrl = undefined;
    if (file) {
      setProgress(prev => ({ ...prev, status: 'Fazendo upload do anexo...' }));
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `anexos/${fileName}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('whatsapp_media')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Falha ao enviar o arquivo anexo.');
        setIsSending(false);
        setIsUploading(false);
        runningRef.current = false;
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('whatsapp_media')
        .getPublicUrl(filePath);
        
      mediaUrl = publicUrlData.publicUrl;
      setIsUploading(false);
    }

    for (let i = 0; i < inscricoes.length; i++) {
      if (!runningRef.current) break;
      
      const ins = inscricoes[i];
      try {
        const phone = ins.telefone_responsavel || ins.whatsapp_responsavel || ins.respostas_personalizadas?.['WhatsApp do Responsável'];
        if (!phone) {
          throw new Error('Telefone não encontrado');
        }

        const responsavelNome = (ins.nome_responsavel || 'Responsável').split(' ')[0];
        const alunoNome = (ins.nome_aluno || 'Estudante').split(' ')[0];

        let personalizedMessage = message
          .replace(/{{responsavel}}/gi, responsavelNome)
          .replace(/{{aluno}}/gi, alunoNome)
          .replace(/{{turma}}/gi, ins.categoria || 'Geral')
          .replace(/{{unidade}}/gi, 'Sport for Kids');

        const token = sessionStorage.getItem('admin_token');
        const headers = token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };

        // Ensure we send to a clean phone number
        let cleanFone = phone.replace(/\D/g, '');
        if (cleanFone && cleanFone.length >= 10 && !cleanFone.startsWith('55')) {
          cleanFone = '55' + cleanFone;
        }

        const res = await fetch('/api/admin/whatsapp/send', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            phone: cleanFone,
            name: responsavelNome,
            message: personalizedMessage,
            mediaUrl
          })
        });

        if (!res.ok) {
          console.error(`Falha na API para o número ${cleanFone}`);
        }

        setProgress({ current: i + 1, total: inscricoes.length, status: `Enviado ${i + 1} de ${inscricoes.length}...` });

        // Random delay between 7s and 10s
        if (i < inscricoes.length - 1 && runningRef.current) {
          const delay = Math.floor(Math.random() * (10000 - 7000 + 1)) + 7000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }

      } catch (err: any) {
        console.error(`Erro ao enviar para ${ins.nome_aluno}:`, err);
        setProgress({ current: i + 1, total: inscricoes.length, status: `Erro ao enviar para ${ins.nome_aluno}. Continuar...` });
      }
    }

    if (runningRef.current) {
      setIsSending(false);
      setProgress(prev => ({ ...prev, status: 'Concluído!' }));
      runningRef.current = false;
      toast.success('Envio em massa concluído!');
      setTimeout(() => onClose(), 2000);
    }
  };

  const percentage = progress.total === 0 ? 0 : Math.round((progress.current / progress.total) * 100);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
        <div className="p-8 bg-indigo-600 text-white flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-2xl font-black uppercase tracking-tight">Disparo de WhatsApp em Massa</h3>
            <p className="text-indigo-100 text-[10px] font-black uppercase tracking-widest mt-1">
              {progress.total} inscrições selecionadas
            </p>
          </div>
          <button 
            onClick={() => {
              if (isSending) {
                if (window.confirm('O envio está em andamento. Deseja cancelar e fechar?')) {
                  runningRef.current = false;
                  onClose();
                }
              } else {
                onClose();
              }
            }} 
            className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-10 flex-1 overflow-y-auto custom-scrollbar space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Mensagem Padrão</label>
                <textarea 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={isSending}
                  className="w-full h-40 bg-slate-50 border-2 border-slate-100 rounded-3xl p-6 text-slate-700 font-medium focus:border-indigo-500 focus:ring-0 transition-all resize-none disabled:opacity-50"
                  placeholder="Digite sua mensagem..."
                />
                <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase">Tags: {"{{aluno}}, {{responsavel}}, {{turma}}, {{unidade}}"}</p>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Anexo (Imagem, Vídeo ou Documento)</label>
                <div 
                  onClick={() => !isSending && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-3xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all ${isSending ? 'opacity-50 cursor-not-allowed border-slate-200 bg-slate-50' : 'border-indigo-200 hover:border-indigo-500 hover:bg-indigo-50 bg-indigo-50/30'}`}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileSelect} 
                    className="hidden" 
                    disabled={isSending}
                    accept="image/*,video/*,application/pdf"
                  />
                  {file ? (
                    <div className="flex items-center gap-3 text-indigo-700">
                      <FileIcon className="w-8 h-8" />
                      <div className="text-left">
                        <p className="text-sm font-bold truncate max-w-[200px]">{file.name}</p>
                        <p className="text-[10px] font-medium opacity-70">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      {!isSending && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setFile(null); }}
                          className="ml-4 p-2 hover:bg-indigo-100 rounded-full"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-indigo-400 mb-2" />
                      <p className="text-sm font-bold text-indigo-600">Clique para anexar arquivo</p>
                      <p className="text-xs text-indigo-400 mt-1">Até 16MB via Frontend (sem limite Vercel)</p>
                    </>
                  )}
                </div>
              </div>

              {isSending && (
                <div className="bg-blue-50 border border-blue-100 rounded-3xl p-6 space-y-4">
                  <div className="flex justify-between items-center text-[10px] font-black text-blue-600 uppercase">
                    <span>{progress.status}</span>
                    <span>{percentage}%</span>
                  </div>
                  <div className="h-2 w-full bg-white rounded-full overflow-hidden border border-blue-100">
                    <div 
                      className="h-full bg-blue-600 transition-all duration-500" 
                      style={{ width: `${percentage}%` }} 
                    />
                  </div>
                </div>
              )}

              <button 
                onClick={startSending}
                disabled={isSending || progress.total === 0}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6 rounded-3xl font-black text-sm flex items-center justify-center gap-4 shadow-xl active:scale-95 disabled:opacity-50 transition-all"
              >
                {isSending ? <Loader className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6 fill-current" />} 
                {isSending ? 'ENVIANDO...' : 'INICIAR DISPAROS'}
              </button>
            </div>

            <div className="bg-slate-50 rounded-[32px] p-8 border border-slate-100 h-full max-h-[400px] flex flex-col">
              <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-4">Pré-visualização</h4>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 flex-1 overflow-y-auto">
                <p className="text-sm text-slate-600 whitespace-pre-wrap">
                  {message
                    .replace(/{{responsavel}}/gi, (inscricoes[0]?.nome_responsavel?.split(' ')[0]) || 'João')
                    .replace(/{{aluno}}/gi, (inscricoes[0]?.nome_aluno?.split(' ')[0]) || 'Pedro')
                    .replace(/{{turma}}/gi, inscricoes[0]?.categoria || 'Geral')
                    .replace(/{{unidade}}/gi, 'Sport for Kids')}
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
