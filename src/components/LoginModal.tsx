import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, LogIn, ArrowRight, UserPlus, RefreshCw, ChevronLeft, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (guardianData: any, preferredUnit?: string) => void;
  unidades?: any[];
}

export default function LoginModal({ isOpen, onClose, onLoginSuccess, unidades = [] }: LoginModalProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'select_unit'>('login');
  const [registerStep, setRegisterStep] = useState<1 | 2 | 3>(1);
  
  // Login State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [recoveringPassword, setRecoveringPassword] = useState(false);
  
  // Select Unit State
  const [pendingLoginData, setPendingLoginData] = useState<any>(null);
  const [availableUnits, setAvailableUnits] = useState<string[]>([]);

  // Register State
  const [formData, setFormData] = useState({
    unidade: '',
    cpf: '',
    name: '',
    email: '',
    phone: '',
    password: '',
    cep: '',
    rua: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: ''
  });
  const [searchingGuardian, setSearchingGuardian] = useState(false);
  const [fetchingAddress, setFetchingAddress] = useState(false);

  const resetModal = () => {
    setMode('login');
    setRegisterStep(1);
    setIdentifier('');
    setPassword('');
    setFormData({
      unidade: '', cpf: '', name: '', email: '', phone: '', password: '',
      cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: ''
    });
    setPendingLoginData(null);
    setAvailableUnits([]);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier) {
      toast.error('Informe seu CPF ou E-mail.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/guardian/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password: password || undefined })
      });
      const data = await res.json();
      
      if (!res.ok) {
        if (data.passwordRequired) {
          toast.error('Senha obrigatória.');
        } else {
          toast.error(data.error || 'Erro ao acessar o portal.');
        }
        return;
      }

      const uniqueUnits = new Set<string>();
      if (data.alunos && Array.isArray(data.alunos)) {
        for (const aluno of data.alunos) {
          if (aluno.unidade) {
            uniqueUnits.add(aluno.unidade);
          } else if (aluno.matriculas && Array.isArray(aluno.matriculas)) {
            for (const matricula of aluno.matriculas) {
              if (matricula.unidade) uniqueUnits.add(matricula.unidade);
            }
          }
        }
      }
      const unitsArray = Array.from(uniqueUnits);

      if (unitsArray.length > 1) {
        setPendingLoginData(data);
        setAvailableUnits(unitsArray);
        setMode('select_unit');
      } else {
        const chosenUnit = unitsArray.length === 1 ? unitsArray[0] : undefined;
        onLoginSuccess(data, chosenUnit);
      }
    } catch (err) {
      toast.error('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverPassword = async () => {
    if (!identifier) {
      toast.error('Por favor, informe seu CPF ou E-mail primeiro.');
      return;
    }
    
    setRecoveringPassword(true);
    try {
      const response = await fetch('/api/guardian/recover-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier })
      });
      
      const contentType = response.headers.get("content-type");
      if (!contentType || contentType.indexOf("application/json") === -1) {
        toast.error("Erro de servidor");
        return;
      }
      
      const data = await response.json();
      if (response.ok) {
        toast.success('Sua senha de acesso foi enviada por WhatsApp ao contato cadastrado.', { duration: 5000 });
      } else {
        toast.error(data.error || 'Erro ao recuperar senha');
      }
    } catch (error: any) {
      toast.error(`Erro de conexão ao recuperar senha: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setRecoveringPassword(false);
    }
  };

  const checkCPF = async (cpf: string) => {
    const cleanCPF = cpf.replace(/\D/g, '');
    if (cleanCPF.length !== 11) return;

    setSearchingGuardian(true);
    try {
      const response = await fetch(`/api/guardian/${cpf}`);
      const contentType = response.headers.get("content-type");
      if (!contentType || contentType.indexOf("application/json") === -1) {
        return;
      }
      
      const data = await response.json();
      
      if (data && data.exists) {
        toast.error('Este CPF já possui cadastro. Faça login para acessar.');
        setIdentifier(cpf);
        setMode('login');
        setRegisterStep(1);
      }
    } catch (error) {
      console.error('Error checking CPF:', error);
    } finally {
      setSearchingGuardian(false);
    }
  };

  const fetchAddressByCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    setFetchingAddress(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          rua: data.logradouro || '',
          bairro: data.bairro || '',
          cidade: data.localidade || '',
          estado: data.uf || ''
        }));
      }
    } catch (error) {
      console.error('Error fetching address by CEP:', error);
    } finally {
      setFetchingAddress(false);
    }
  };

  const handleRegisterNextStep = () => {
    if (registerStep === 1) {
      if (!formData.unidade) {
        toast.error('Selecione uma unidade de preferência.');
        return;
      }
      if (!formData.cpf || formData.cpf.replace(/\D/g, '').length !== 11) {
        toast.error('Informe um CPF válido.');
        return;
      }
      setRegisterStep(2);
    } else if (registerStep === 2) {
      if (!formData.name || !formData.email || !formData.phone || !formData.password) {
        toast.error('Preencha todos os dados pessoais.');
        return;
      }
      setRegisterStep(3);
    } else if (registerStep === 3) {
      if (!formData.cep || !formData.rua || !formData.numero || !formData.bairro || !formData.cidade || !formData.estado) {
        toast.error('Preencha o endereço completo.');
        return;
      }
      submitRegistration();
    }
  };

  const submitRegistration = async () => {
    setLoading(true);
    try {
      const addressJson = JSON.stringify({
        zipCode: formData.cep,
        street: formData.rua,
        number: formData.numero,
        complement: formData.complemento,
        neighborhood: formData.bairro,
        city: formData.cidade,
        state: formData.estado
      });

      const response = await fetch('/api/guardian/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          cpf: formData.cpf,
          email: formData.email,
          phone: formData.phone,
          address: addressJson,
          password: formData.password
        })
      });
      
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Erro ao registrar responsável.');
        return;
      }

      toast.success('Cadastro realizado com sucesso!');
      onLoginSuccess(data.guardian, formData.unidade);
      resetModal();
    } catch (err) {
      toast.error('Erro de conexão ao registrar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            onClick={handleClose}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className={`relative w-full ${mode === 'register' ? 'max-w-xl' : 'max-w-md'} bg-white/90 backdrop-blur-xl border border-white/50 rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] overflow-hidden transition-all duration-300`}
          >
            <div className="absolute top-4 right-4 z-10">
              <button 
                onClick={handleClose}
                className="p-2 bg-slate-100/50 hover:bg-slate-200/50 rounded-full text-slate-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 max-h-[90vh] overflow-y-auto">
              {mode === 'login' ? (
                // --- LOGIN MODE ---
                <>
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-200">
                    <LogIn className="text-white" size={28} />
                  </div>
                  
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Área do Cliente</h2>
                  <p className="text-sm text-slate-500 font-medium mb-8">Acesse para gerenciar matrículas, turmas e faturas dos seus alunos.</p>

                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">CPF ou E-mail</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Mail className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          className="block w-full pl-11 pr-4 py-3.5 bg-white/50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                          placeholder="seu@email.com ou 000.000.000-00"
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Senha</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Lock className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type="password"
                          className="block w-full pl-11 pr-4 py-3.5 bg-white/50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </div>
                      <div className="text-right flex items-center justify-between mt-1.5">
                        <a 
                          href="/tutoriais"
                          className="text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors"
                        >
                          Dúvidas? Veja nossos Tutoriais
                        </a>
                        <button
                          type="button"
                          onClick={handleRecoverPassword}
                          disabled={recoveringPassword}
                          className="text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors"
                        >
                          {recoveringPassword ? 'Enviando...' : 'Esqueci minha senha'}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full mt-6 bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-2 group disabled:opacity-70 shadow-lg shadow-slate-200"
                    >
                      {loading ? (
                        <span className="animate-pulse">Acessando...</span>
                      ) : (
                        <>
                          Acessar Portal
                          <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </button>
                  </form>
                  
                  <div className="mt-6 text-center">
                    <p className="text-sm text-slate-600">
                      Não tem uma conta?{' '}
                      <button 
                        onClick={() => {
                          setMode('register');
                          setRegisterStep(1);
                        }}
                        className="font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
                      >
                        Novo Cadastro
                      </button>
                    </p>
                  </div>
                </>
              ) : mode === 'select_unit' ? (
                // --- SELECT UNIT MODE ---
                <>
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-200">
                    <MapPin className="text-white" size={28} />
                  </div>
                  
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Selecione a Unidade</h2>
                  <p className="text-sm text-slate-500 font-medium mb-8">Identificamos que você possui alunos em mais de uma unidade. Escolha qual portal deseja acessar agora:</p>

                  <div className="space-y-3">
                    {availableUnits.map((u, idx) => {
                      const unitObj = unidades.find(un => (un.slug || un.nome?.toLowerCase().replace(/\s+/g, '-')) === u.toLowerCase().replace(/\s+/g, '-') || un.nome === u);
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            const slug = unitObj ? (unitObj.slug || unitObj.nome.toLowerCase().replace(/\s+/g, '-')) : u.toLowerCase().replace(/\s+/g, '-');
                            onLoginSuccess(pendingLoginData, slug);
                          }}
                          className="w-full p-4 bg-white border border-slate-200 rounded-2xl hover:border-indigo-500 hover:shadow-md transition-all flex items-center justify-between group text-left"
                        >
                          <div className="flex items-center gap-4">
                            {unitObj && unitObj.logo_url ? (
                              <img src={unitObj.logo_url} alt={unitObj.nome} className="w-10 h-10 object-contain bg-slate-50 p-1 rounded-xl" />
                            ) : (
                              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                                <MapPin className="text-indigo-500" size={20} />
                              </div>
                            )}
                            <div>
                              <span className="block font-bold text-slate-800">{unitObj ? unitObj.nome : u}</span>
                              <span className="block text-xs text-slate-500">Acessar portal da unidade</span>
                            </div>
                          </div>
                          <ArrowRight className="text-slate-300 group-hover:text-indigo-500 transition-colors" size={20} />
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                // --- REGISTER MODE ---
                <>
                  <div className="flex items-center gap-4 mb-8">
                    {registerStep > 1 && (
                      <button 
                        onClick={() => setRegisterStep(registerStep - 1 as any)}
                        className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                      >
                        <ChevronLeft size={20} className="text-slate-600" />
                      </button>
                    )}
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
                      <UserPlus className="text-white" size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-800 tracking-tight">Novo Cadastro</h2>
                      <p className="text-xs text-slate-500 font-medium">Passo {registerStep} de 3</p>
                    </div>
                  </div>

                  <div className="space-y-5">
                    {registerStep === 1 && (
                      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Unidade de Preferência</label>
                            <select 
                              className="block w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                              value={formData.unidade}
                              onChange={e => setFormData({...formData, unidade: e.target.value})}
                            >
                              <option value="">Selecione a unidade</option>
                              {unidades.filter(u => typeof u === 'object' && u.nome).map((u: any, idx: number) => (
                                <option key={idx} value={u.slug || u.nome.toLowerCase().replace(/\s+/g, '-')}>
                                  {u.nome}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">CPF do Responsável</label>
                            <div className="relative">
                              <input 
                                type="text" 
                                className="block w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                                placeholder="000.000.000-00"
                                value={formData.cpf}
                                onChange={e => {
                                  const val = e.target.value;
                                  setFormData({...formData, cpf: val});
                                  if (val.replace(/\D/g, '').length === 11) {
                                    checkCPF(val);
                                  }
                                }}
                              />
                              {searchingGuardian && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                  <RefreshCw size={18} className="animate-spin text-emerald-600" />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {registerStep === 2 && (
                      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nome Completo</label>
                            <input 
                              type="text" 
                              className="block w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                              value={formData.name}
                              onChange={e => setFormData({...formData, name: e.target.value})}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">E-mail</label>
                            <input 
                              type="email" 
                              className="block w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                              value={formData.email}
                              onChange={e => setFormData({...formData, email: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Telefone</label>
                            <input 
                              type="text" 
                              className="block w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                              placeholder="(00) 00000-0000"
                              value={formData.phone}
                              onChange={e => setFormData({...formData, phone: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Crie uma Senha</label>
                            <input 
                              type="password" 
                              className="block w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                              value={formData.password}
                              onChange={e => setFormData({...formData, password: e.target.value})}
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {registerStep === 3 && (
                      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="relative">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">CEP</label>
                            <input 
                              type="text" 
                              className="block w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                              placeholder="00000-000"
                              value={formData.cep}
                              onChange={e => {
                                const val = e.target.value;
                                setFormData({...formData, cep: val});
                                if (val.replace(/\D/g, '').length === 8) {
                                  fetchAddressByCep(val);
                                }
                              }}
                            />
                            {fetchingAddress && (
                              <div className="absolute right-3 top-10">
                                <RefreshCw size={16} className="animate-spin text-emerald-600" />
                              </div>
                            )}
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Rua / Avenida</label>
                            <input 
                              type="text" 
                              className="block w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                              value={formData.rua}
                              onChange={e => setFormData({...formData, rua: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Número</label>
                            <input 
                              type="text" 
                              className="block w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                              value={formData.numero}
                              onChange={e => setFormData({...formData, numero: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Complemento</label>
                            <input 
                              type="text" 
                              className="block w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                              value={formData.complemento}
                              onChange={e => setFormData({...formData, complemento: e.target.value})}
                            />
                          </div>
                          <div className="md:col-span-2 grid grid-cols-3 gap-4">
                            <div className="col-span-1">
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Bairro</label>
                              <input 
                                type="text" 
                                className="block w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                                value={formData.bairro}
                                onChange={e => setFormData({...formData, bairro: e.target.value})}
                              />
                            </div>
                            <div className="col-span-1">
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Cidade</label>
                              <input 
                                type="text" 
                                className="block w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                                value={formData.cidade}
                                onChange={e => setFormData({...formData, cidade: e.target.value})}
                              />
                            </div>
                            <div className="col-span-1">
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">UF</label>
                              <input 
                                type="text" 
                                className="block w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                                value={formData.estado}
                                onChange={e => setFormData({...formData, estado: e.target.value})}
                              />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    <div className="pt-4 flex gap-3">
                      {registerStep === 1 && (
                        <button
                          type="button"
                          onClick={() => setMode('login')}
                          className="flex-1 py-4 px-6 rounded-xl font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
                        >
                          Já tenho conta
                        </button>
                      )}
                      
                      <button
                        type="button"
                        onClick={handleRegisterNextStep}
                        disabled={loading}
                        className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-2 group shadow-lg shadow-emerald-200 disabled:opacity-70"
                      >
                        {loading ? (
                          <span className="animate-pulse">Processando...</span>
                        ) : registerStep === 3 ? (
                          <>Finalizar Cadastro <ArrowRight size={18} /></>
                        ) : (
                          <>Próximo Passo <ArrowRight size={18} /></>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
