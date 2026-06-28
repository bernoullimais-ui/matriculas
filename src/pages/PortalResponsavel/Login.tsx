import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail, AlertCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PortalLogin() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [recoverMode, setRecoverMode] = useState(false);
  const [recoverIdentifier, setRecoverIdentifier] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/guardian/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Assume API returns a token or sets a cookie
        if (data.token) sessionStorage.setItem('guardian_token', data.token);
        const guardianInfo = data.guardian || data;
        sessionStorage.setItem('guardian_data', JSON.stringify(guardianInfo));
        localStorage.setItem('guardian', JSON.stringify(guardianInfo));
        
        const alunos = guardianInfo.alunos || [];
        let firstUnit = '';
        if (alunos && Array.isArray(alunos)) {
          for (const aluno of alunos) {
            if (aluno.unidade) {
              firstUnit = aluno.unidade;
              break;
            }
          }
        }

        toast.success('Bem-vindo à Área do Cliente!');
        
        if (firstUnit) {
          const slug = firstUnit.toLowerCase().replace(/\s+/g, '-');
          window.location.href = `/portal/${slug}?action=portal`;
        } else {
          window.location.href = `/portal?action=portal`;
        }
      } else {
        toast.error(data.error || 'Credenciais inválidas');
      }
    } catch (error) {
      toast.error('Erro de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/guardian/recover-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: recoverIdentifier }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Uma senha provisória foi enviada para o seu WhatsApp!');
        setRecoverMode(false);
      } else {
        toast.error(data.error || 'Não encontramos um cadastro com este dado.');
      }
    } catch (error) {
      toast.error('Erro de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6 relative overflow-hidden font-sans">
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-indigo-50 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-50 rounded-full blur-3xl opacity-50 translate-y-1/3 -translate-x-1/3 pointer-events-none"></div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-8 md:p-10 relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-200">
            <Lock size={28} />
          </div>
          <h1 className="text-3xl font-black text-slate-800 mb-2">Área do Cliente</h1>
          <p className="text-slate-500 text-sm font-medium">Faça login para gerenciar suas matrículas e visualizar recibos.</p>
        </div>

        {!recoverMode ? (
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">E-mail ou CPF</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Seu e-mail ou CPF"
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha"
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 group disabled:opacity-70"
            >
              {loading ? 'Acessando...' : 'Entrar na Conta'}
              {!loading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
            </button>

            <div className="text-center pt-4">
              <button
                type="button"
                onClick={() => setRecoverMode(true)}
                className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                Esqueci minha senha / Primeiro Acesso
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRecover} className="space-y-5">
            <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex gap-3 mb-6">
              <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <p className="text-sm text-indigo-800 font-medium">
                Enviaremos uma senha provisória para o número de WhatsApp associado a este cadastro.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">E-mail ou CPF Cadastrado</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  required
                  value={recoverIdentifier}
                  onChange={(e) => setRecoverIdentifier(e.target.value)}
                  placeholder="Seu e-mail ou CPF"
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 group disabled:opacity-70"
            >
              {loading ? 'Enviando...' : 'Receber Nova Senha'}
              {!loading && <CheckCircle2 size={18} />}
            </button>

            <div className="text-center pt-4">
              <button
                type="button"
                onClick={() => setRecoverMode(false)}
                className="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
              >
                Voltar para o Login
              </button>
            </div>
          </form>
        )}
      </div>
      
      <div className="mt-8 text-center text-xs font-bold text-slate-400 uppercase tracking-widest relative z-10">
        Desenvolvido por Sport for Kids
      </div>
    </div>
  );
}
