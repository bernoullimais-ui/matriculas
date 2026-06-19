import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, CheckCircle, AlertCircle, Copy, Check, Info } from 'lucide-react';
import toast from 'react-hot-toast';

const PagamentoPix = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchPixData = async () => {
    try {
      const res = await fetch(`/api/public/pix/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao buscar pagamento');
      
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchPixData();
      
      // Auto-refresh every 10 seconds to check status
      const interval = setInterval(() => {
        fetchPixData();
      }, 10000);
      
      return () => clearInterval(interval);
    }
  }, [id]);

  const handleCopy = () => {
    if (data?.qr_code) {
      navigator.clipboard.writeText(data.qr_code);
      setCopied(true);
      toast.success('Código copiado!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Erro ao carregar PIX</h2>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  const isPaid = data?.status?.toLowerCase() === 'pago';
  const matricula = data?.matricula;
  // Handle case where aluno is an array or object
  const aluno = matricula?.alunos ? (Array.isArray(matricula.alunos) ? matricula.alunos[0] : matricula.alunos) : null;

  if (isPaid) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-10 rounded-[40px] shadow-xl max-w-md w-full text-center border border-slate-100">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-3">Pagamento Recebido!</h2>
          <p className="text-slate-500 mb-8 leading-relaxed">
            O seu pagamento via PIX foi confirmado com sucesso.
          </p>
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8 text-left">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Estudante</p>
            <p className="text-lg font-bold text-slate-800 mb-4">{aluno?.nome_completo || '—'}</p>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Turma</p>
            <p className="text-lg font-bold text-slate-800 mb-4">{matricula?.turma} - Unidade {matricula?.unidade}</p>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Valor Pago</p>
            <p className="text-lg font-bold text-emerald-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data?.valor || 0)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans py-12 md:py-20 px-4">
      <div className="max-w-xl w-full mx-auto">
        <div className="bg-white rounded-[40px] shadow-xl border border-slate-100 overflow-hidden">
          
          <div className="bg-emerald-600 p-8 text-center text-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
            <div className="relative z-10">
              <h1 className="text-3xl font-black mb-2">Pagar com PIX</h1>
              <p className="text-emerald-100">Escaneie o QR Code ou copie o código para pagar.</p>
            </div>
          </div>

          <div className="p-8">
            <div className="flex flex-col items-center justify-center space-y-6">
              
              {data?.qr_code_url ? (
                <div className="bg-white p-4 rounded-3xl border-4 border-slate-100 shadow-sm">
                  <img 
                    src={data.qr_code_url} 
                    alt="QR Code PIX" 
                    className="w-48 h-48 md:w-64 md:h-64 object-contain"
                  />
                </div>
              ) : (
                <div className="w-48 h-48 md:w-64 md:h-64 bg-slate-100 rounded-3xl flex items-center justify-center border-4 border-slate-50 text-slate-400">
                  <span>QR Code indisponível</span>
                </div>
              )}

              <button 
                onClick={handleCopy}
                className={`w-full py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
                  copied 
                    ? 'bg-emerald-50 text-emerald-700 shadow-emerald-100 border border-emerald-200' 
                    : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-200'
                }`}
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                {copied ? 'Código Copiado!' : 'Copiar código Pix (Copia e Cola)'}
              </button>

            </div>

            <div className="mt-8 border-t border-slate-100 pt-8">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Info className="w-4 h-4" /> Resumo
              </h3>
              
              <div className="bg-slate-50 rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                  <div>
                    <p className="text-sm font-bold text-slate-400">Estudante</p>
                    <p className="font-bold text-slate-800">{aluno?.nome_completo || '—'}</p>
                  </div>
                </div>
                
                <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                  <div>
                    <p className="text-sm font-bold text-slate-400">Turma / Unidade</p>
                    <p className="font-bold text-slate-800">{matricula?.turma}</p>
                    <p className="text-sm text-slate-500">Unidade {matricula?.unidade}</p>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <p className="text-sm font-bold text-slate-400">Total a Pagar</p>
                  <p className="text-2xl font-black text-emerald-600">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data?.valor || 0)}
                  </p>
                </div>
              </div>
            </div>

            <p className="text-center text-sm text-slate-400 font-medium mt-6">
              Esta página atualizará automaticamente assim que o pagamento for confirmado.
            </p>

          </div>
        </div>
      </div>
    </div>
  );
};

export default PagamentoPix;
