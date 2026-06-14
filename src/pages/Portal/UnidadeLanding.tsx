import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { CalendarDays, GraduationCap, MapPin, Phone, Users, User, ArrowLeft, ArrowRight, CheckCircle2, ShoppingBag, Calendar, CreditCard, LogOut, Share2 } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import LoginModal from '../../components/LoginModal';
import TrialModal from '../../components/TrialModal';
import EnrollmentModal from '../../components/EnrollmentModal';

interface Turma {
  id: string;
  nome: string;
  unidade_nome: string;
  series_permitidas: string[] | string;
  dias_horarios: string;
  valor_mensalidade: number;
  precos_unidade?: Record<string, number>;
  capacidade: number;
  ocupacao_atual: number;
  local_aula: string;
  data_inicio: string;
  professor: string;
  imagem_url?: string;
  descricao?: string;
  foto_professor_url?: string;
}

interface Unidade {
  nome: string;
  slug: string;
  logo_url?: string;
  imagem_url?: string;
  parceria?: string;
  logo_parceiro_url?: string;
}

export default function UnidadeLanding() {
  const { unidadeSlug, turmaId } = useParams<{ unidadeSlug: string; turmaId?: string }>();
  const navigate = useNavigate();
  const [unidade, setUnidade] = useState<Unidade | null>(null);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [allSeries, setAllSeries] = useState<string[]>([]);
  const [todasUnidades, setTodasUnidades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (unidade) {
      document.title = `Portal ${unidade.nome} — Sport for Kids`;
    } else {
      document.title = 'Portal da Unidade — Sport for Kids';
    }
  }, [unidade]);

  useEffect(() => {
    if (turmas.length > 0 && turmaId) {
      setTimeout(() => {
        const el = document.getElementById(`turma-${turmaId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-4', 'ring-indigo-500', 'ring-offset-4', 'transition-all', 'duration-500');
          setTimeout(() => {
            el.classList.remove('ring-4', 'ring-indigo-500', 'ring-offset-4');
          }, 3000);
        }
      }, 500);
    }
  }, [turmas, turmaId]);
  
  const [guardian, setGuardian] = useState<any>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  
  const [isTrialModalOpen, setIsTrialModalOpen] = useState(false);
  const [isEnrollmentModalOpen, setIsEnrollmentModalOpen] = useState(false);
  const [bookingData, setBookingData] = useState({ unidade: '', turma: '' });
  const [pendingAction, setPendingAction] = useState<'matricula' | 'experimental' | null>(null);
  
  // States for Portal Tabs
  const [modalInitialStep, setModalInitialStep] = useState<'landing' | 'guardian' | 'student' | 'enrollment' | 'payment' | 'success' | 'waitlist_success' | 'admin' | 'portal' | 'complete_profile' | undefined>(undefined);
  const [modalInitialTab, setModalInitialTab] = useState<'dashboard' | 'payments' | 'profile' | 'documents' | undefined>(undefined);

  useEffect(() => {
    const stored = localStorage.getItem('guardian');
    if (stored) {
      try {
        setGuardian(JSON.parse(stored));
      } catch (e) {}
    }
  }, []);
  
  const [selectedEscolaridade, setSelectedEscolaridade] = useState<string>('todos');
  const [selectedModalidade, setSelectedModalidade] = useState<string>('todos');

  const derivedEscolaridades = React.useMemo(() => {
    const activeSeriesInUnit = new Set<string>();
    for (const t of turmas) {
      const series = t.series_permitidas;
      if (Array.isArray(series)) {
        series.forEach(s => {
          if (s) activeSeriesInUnit.add(s.trim());
        });
      } else if (typeof series === 'string' && series.trim()) {
        series.split(',').forEach(s => {
          if (s) activeSeriesInUnit.add(s.trim());
        });
      }
    }

    if (allSeries.length > 0) {
      return allSeries.filter(s => activeSeriesInUnit.has(s));
    }
    return Array.from(activeSeriesInUnit).sort();
  }, [allSeries, turmas]);

  const derivedModalidades = React.useMemo(() => {
    const getBaseModality = (name: string) => {
      return name
        .replace(/\s+\d+\s*$/g, '')
        .replace(/\s+(Segunda|Terça|Quarta|Quinta|Sexta|Sábado|Domingo).*$/gi, '')
        .trim();
    };
    const set = new Set<string>();
    for (const t of turmas) {
      set.add(getBaseModality(t.nome));
    }
    return Array.from(set).sort();
  }, [turmas]);

  const filteredTurmas = React.useMemo(() => {
    const getBaseModality = (name: string) => {
      return name
        .replace(/\s+\d+\s*$/g, '')
        .replace(/\s+(Segunda|Terça|Quarta|Quinta|Sexta|Sábado|Domingo).*$/gi, '')
        .trim();
    };
    
    const normalize = (str: string) => 
      String(str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');

    return turmas.filter(t => {
      // 1. Escolaridade Match
      let matchesEscolaridade = true;
      if (selectedEscolaridade !== 'todos') {
        const normSelected = normalize(selectedEscolaridade);
        const series = t.series_permitidas;
        if (!series) {
          matchesEscolaridade = false;
        } else if (Array.isArray(series)) {
          matchesEscolaridade = series.some(s => normalize(String(s)).includes(normSelected) || normSelected.includes(normalize(String(s))));
        } else {
          const list = String(series).split(',').map(s => normalize(s.trim()));
          matchesEscolaridade = list.some(s => s.includes(normSelected) || normSelected.includes(s));
        }
      }

      // 2. Modalidade Match
      let matchesModalidade = true;
      if (selectedModalidade !== 'todos') {
        matchesModalidade = getBaseModality(t.nome) === selectedModalidade;
      }

      return matchesEscolaridade && matchesModalidade;
    });
  }, [turmas, selectedEscolaridade, selectedModalidade]);

  useEffect(() => {
    async function fetchUnidadeData() {
      try {
        const res = await fetch('/api/options');
        if (res.ok) {
          const data = await res.json();
          setAllSeries(data.series || []);
          setTodasUnidades(data.unidades || []);
          const foundUnit = (data.unidades || []).find(
            (u: any) => u.slug === unidadeSlug
          );

          if (foundUnit) {
            setUnidade(foundUnit);
            localStorage.setItem('last_unit_slug', foundUnit.slug);
            // Filter classes for this unit
            const unitClasses = (data.turmas || []).filter(
              (t: any) => (t.unidade_nome === foundUnit.nome || (t.unidades_selecionadas && t.unidades_selecionadas.includes(foundUnit.nome))) && (t.status || 'ativo') === 'ativo'
            );
            setTurmas(unitClasses);
          } else {
            // fallback if slug not found, try by name decode
            const decodedName = decodeURIComponent(unidadeSlug || '');
            const foundByName = (data.unidades || []).find(
              (u: any) => u.nome.toLowerCase() === decodedName.toLowerCase()
            );
            if (foundByName) {
              setUnidade(foundByName);
              localStorage.setItem('last_unit_slug', foundByName.slug || decodedName);
              const unitClasses = (data.turmas || []).filter(
                (t: any) => (t.unidade_nome === foundByName.nome || (t.unidades_selecionadas && t.unidades_selecionadas.includes(foundByName.nome))) && (t.status || 'ativo') === 'ativo'
              );
              setTurmas(unitClasses);
            }
          }
        }
      } catch (err) {
        console.error('Error loading landing page data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchUnidadeData();
  }, [unidadeSlug]);

  const handleLogout = () => {
    localStorage.removeItem('guardian');
    setGuardian(null);
    toast.success('Desconectado com sucesso');
  };

  const handleAction = (action: 'matricula' | 'experimental', classObj?: Turma) => {
    if (!unidade) return;
    
    if (guardian) {
      // Logged in: open specific modals instead of redirecting
      if (action === 'experimental') {
        setBookingData({
          unidade: unidade.nome,
          turma: classObj ? classObj.nome : ''
        });
        setIsTrialModalOpen(true);
      } else {
        // Redireciona para matricula em modal na mesma página
        setModalInitialStep('portal');
        setModalInitialTab('dashboard');
        setIsEnrollmentModalOpen(true);
      }
    } else {
      // Not logged in: save pending action and open login modal
      setPendingAction(action);
      if (action === 'experimental') {
        setBookingData({
          unidade: unidade.nome,
          turma: classObj ? classObj.nome : ''
        });
      }
      setIsLoginModalOpen(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!unidade) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-3xl font-black text-slate-800">Unidade não localizada 😢</h1>
        <p className="text-slate-500 mt-2 max-w-sm">A escola informada não foi encontrada ou não possui uma página configurada.</p>
        <Link to="/" className="mt-6 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg hover:bg-indigo-700 transition-all">
          Ir para a Página Inicial
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-16">
      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)} 
        onLoginSuccess={(data) => {
          setGuardian(data.guardian || data);
          localStorage.setItem('guardian', JSON.stringify(data.guardian || data));
          setIsLoginModalOpen(false);
          toast.success(`Bem-vindo, ${(data.guardian || data).nome_completo?.split(' ')[0]}!`);
          
          if (pendingAction === 'matricula') {
            setModalInitialStep('portal');
            setModalInitialTab('dashboard');
            setIsEnrollmentModalOpen(true);
            setPendingAction(null);
          } else if (pendingAction === 'experimental') {
            setIsTrialModalOpen(true);
            setPendingAction(null);
          }
        }} 
        unidades={todasUnidades}
      />

      <TrialModal 
        isOpen={isTrialModalOpen}
        onClose={() => setIsTrialModalOpen(false)}
        guardian={guardian}
        setGuardian={setGuardian}
        unidades={todasUnidades}
        turmas={turmas}
        series={allSeries}
        initialUnidade={bookingData.unidade}
        initialTurma={bookingData.turma}
      />

      <EnrollmentModal
        isOpen={isEnrollmentModalOpen}
        onClose={() => setIsEnrollmentModalOpen(false)}
        preSelectedUnidade={unidade.nome}
        initialStep={modalInitialStep}
        initialPortalTab={modalInitialTab}
      />

      {/* Dynamic Hero Section */}
      <div className="relative h-[45vh] md:h-[55vh] w-full overflow-hidden bg-slate-900">
        {unidade.imagem_url ? (
          <img 
            src={unidade.imagem_url} 
            alt={unidade.nome} 
            className="w-full h-full object-cover opacity-40 scale-105 transform motion-safe:animate-[subtle-zoom_20s_ease-out_infinite]"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-950 via-slate-900 to-indigo-900 opacity-60"></div>
        )}
        
        {/* Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-slate-900/40 to-slate-950/20"></div>

        {/* Back Link */}
        <button 
          onClick={() => navigate('/')}
          className="absolute top-6 left-6 z-20 p-2.5 bg-white/10 hover:bg-white/20 text-white backdrop-blur-md rounded-2xl transition-all flex items-center justify-center gap-1.5"
        >
          <ArrowLeft size={16} /> <span className="text-xs font-bold">Voltar</span>
        </button>

        {/* Right Action (Logout) */}
        {guardian && (
          <button 
            onClick={handleLogout}
            className="absolute top-6 right-6 z-20 p-2.5 bg-white/10 hover:bg-red-500/80 hover:text-white text-white backdrop-blur-md rounded-2xl transition-all flex items-center justify-center gap-1.5"
            title="Sair"
          >
            <span className="text-xs font-bold hidden sm:block">Sair</span> <LogOut size={16} />
          </button>
        )}

        {/* Hero Content */}
        <div className="absolute bottom-10 left-0 right-0 z-10">
          <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
              {/* Partnership status */}
              {unidade.parceria && (
                <div className="inline-flex items-center gap-2 bg-white/10 text-white px-3.5 py-1.5 rounded-full border border-white/20 backdrop-blur-md text-xs font-bold shadow-sm">
                  <span>Parceiro Oficial: <strong>{unidade.parceria}</strong></span>
                  {unidade.logo_parceiro_url && (
                    <img src={unidade.logo_parceiro_url} alt="Logo Parceiro" className="h-4 object-contain bg-white/20 p-0.5 rounded" />
                  )}
                </div>
              )}
              
              <h1 className="text-3xl md:text-5xl font-black text-white drop-shadow-sm tracking-tight">{unidade.nome}</h1>
              <p className="text-white/80 font-medium text-sm md:text-base max-w-xl flex items-center gap-1.5">
                <MapPin size={18} className="text-indigo-400 shrink-0" /> Atividades esportivas oficiais integradas ao ambiente escolar.
              </p>
            </div>

            {/* School logo overlap container */}
            {unidade.logo_url && (
              <div className="shrink-0 bg-white p-3.5 rounded-3xl shadow-xl border border-slate-100 hidden md:block">
                <img src={unidade.logo_url} alt="Logo Escola" className="w-24 h-24 object-contain" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Logged in Header */}
      {guardian && (
        <div className="max-w-5xl mx-auto px-6 relative z-20 -mt-8 mb-4">
          <div className="bg-white/90 backdrop-blur-md rounded-3xl p-6 shadow-xl border border-white/50 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-800">
                Olá, {guardian.nome_completo?.split(' ')[0]} 👋
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                Bem-vindo ao seu portal. Gerencie matrículas, acesse suas informações, compre uniformes e inscreva em eventos.
              </p>
            </div>
            <button 
              onClick={() => navigate('/portal')}
              className="shrink-0 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl transition-all shadow-md text-sm"
            >
              Acessar Meu Painel Completo
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className={`max-w-5xl mx-auto px-6 relative z-20 grid grid-cols-1 lg:grid-cols-3 gap-8 ${!guardian ? '-mt-6' : ''}`}>
        {/* Left Side: Call to actions & info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Card Mobile Logo Header */}
          {unidade.logo_url && (
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200/60 flex items-center gap-4 md:hidden">
              <img src={unidade.logo_url} alt="Logo Escola" className="w-14 h-14 object-contain bg-slate-50 p-1 rounded-2xl" />
              <div>
                <h3 className="font-bold text-slate-800 text-sm">SportForKids</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Unidade Parceira</p>
              </div>
            </div>
          )}

          {/* Quick Actions Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm space-y-4">
            <h3 className="font-black text-slate-800 text-base">Comece Hoje Mesmo</h3>
            
            {guardian ? (
              <div className="flex flex-col gap-3 pt-2">
                <button onClick={() => handleAction('experimental')} className="w-full p-4 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-2xl transition-all shadow-md flex items-center gap-3 text-left group">
                  <div className="p-2 bg-white/20 rounded-xl text-xl">✨</div>
                  <div>
                    <span className="block font-black text-sm">Agendar Experimental</span>
                    <span className="block text-[10px] text-emerald-100 mt-0.5">Agende uma aula gratuita</span>
                  </div>
                </button>
                <button onClick={() => handleAction('matricula')} className="w-full p-4 bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-2xl transition-all shadow-md flex items-center gap-3 text-left group">
                  <div className="p-2 bg-white/20 rounded-xl text-xl">📝</div>
                  <div>
                    <span className="block font-black text-sm">Matrículas Online</span>
                    <span className="block text-[10px] text-indigo-100 mt-0.5">Novas turmas ou modalidades</span>
                  </div>
                </button>
                <button onClick={() => navigate('/loja')} className="w-full p-4 bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-2xl transition-all shadow-md flex items-center gap-3 text-left group">
                  <div className="p-2 bg-white/20 rounded-xl text-xl">🛍️</div>
                  <div>
                    <span className="block font-black text-sm">Loja de Uniformes</span>
                    <span className="block text-[10px] text-purple-100 mt-0.5">Compre kits oficiais</span>
                  </div>
                </button>
                <button onClick={() => navigate('/eventos')} className="w-full p-4 bg-gradient-to-br from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white rounded-2xl transition-all shadow-md flex items-center gap-3 text-left group">
                  <div className="p-2 bg-white/20 rounded-xl text-xl">🏆</div>
                  <div>
                    <span className="block font-black text-sm">Eventos & Torneios</span>
                    <span className="block text-[10px] text-pink-100 mt-0.5">Inscrições para competições</span>
                  </div>
                </button>
                
                <hr className="my-2 border-slate-100" />
                
                <button onClick={() => { setModalInitialStep('portal'); setModalInitialTab('profile'); setIsEnrollmentModalOpen(true); }} className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition-all flex items-center gap-3 text-xs text-left border border-slate-200 px-4">
                  <User size={18} className="text-blue-600 shrink-0" /> 
                  <span className="flex-1">Meus Dados (Responsável)</span>
                  <ArrowRight size={14} className="text-slate-400" />
                </button>
                <button onClick={() => { setModalInitialStep('portal'); setModalInitialTab('dashboard'); setIsEnrollmentModalOpen(true); }} className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition-all flex items-center gap-3 text-xs text-left border border-slate-200 px-4">
                  <CreditCard size={18} className="text-emerald-600 shrink-0" /> 
                  <span className="flex-1">Minhas Matrículas</span>
                  <ArrowRight size={14} className="text-slate-400" />
                </button>
                <button onClick={() => navigate('/portal')} className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition-all flex items-center gap-3 text-xs text-left border border-slate-200 px-4">
                  <ShoppingBag size={18} className="text-purple-600 shrink-0" /> 
                  <span className="flex-1">Meus Pedidos</span>
                  <ArrowRight size={14} className="text-slate-400" />
                </button>
                <button onClick={() => navigate('/portal')} className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition-all flex items-center gap-3 text-xs text-left border border-slate-200 px-4">
                  <Calendar size={18} className="text-pink-600 shrink-0" /> 
                  <span className="flex-1">Inscrições em Eventos</span>
                  <ArrowRight size={14} className="text-slate-400" />
                </button>
              </div>
            ) : (
              <>
                <p className="text-slate-500 text-xs leading-relaxed">
                  Para acessar as funcionalidades e gerenciar matrículas, você precisa fazer o login ou criar seu cadastro.
                </p>
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-100/50 flex gap-2">
                  <span className="text-amber-500 text-lg">💡</span>
                  <p className="text-[10px] text-amber-800 font-medium">Faça login para Agendar Aulas, Matricular, acessar a Loja ou ver Eventos.</p>
                </div>
                <div className="space-y-2.5 pt-2">
                  <button 
                    onClick={() => setIsLoginModalOpen(true)}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 text-sm"
                  >
                    Fazer Login ou Cadastro <ArrowRight size={16} />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Benefits Bullet Points */}
          <div className="bg-gradient-to-br from-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl space-y-4">
            <h4 className="font-bold text-indigo-400 text-xs uppercase tracking-wider">Vantagens SFK</h4>
            <ul className="space-y-3">
              {[
                'Sem necessidade de deslocamento fora da escola',
                'Metodologia lúdica e desenvolvimento psicomotor',
                'Professores especializados e credenciados',
                'Materiais e uniformes exclusivos de alta performance'
              ].map((benefit, idx) => (
                <li key={idx} className="flex gap-2 text-xs items-start">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-slate-200 leading-normal">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right Side: Available Classes (Turmas) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-black text-slate-900">Modalidades & Turmas ({filteredTurmas.length})</h2>
              <span className="text-xs text-slate-400 font-medium">{unidade.nome}</span>
            </div>
            
            {/* Active filters summary */}
            {(selectedEscolaridade !== 'todos' || selectedModalidade !== 'todos') && (
              <button
                onClick={() => {
                  setSelectedEscolaridade('todos');
                  setSelectedModalidade('todos');
                }}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl self-start transition-all"
              >
                Limpar Filtros
              </button>
            )}
          </div>

          {turmas.length > 0 && (
            /* Filters Section */
            <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Escolaridade Filter */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Série / Escolaridade</label>
                <select 
                  value={selectedEscolaridade} 
                  onChange={(e) => setSelectedEscolaridade(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-700 transition-all cursor-pointer"
                >
                  <option value="todos">Todas as Séries</option>
                  {derivedEscolaridades.map(esc => (
                    <option key={esc} value={esc}>{esc}</option>
                  ))}
                </select>
              </div>

              {/* Modalidade Filter */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Modalidade</label>
                <select 
                  value={selectedModalidade} 
                  onChange={(e) => setSelectedModalidade(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-700 transition-all cursor-pointer"
                >
                  <option value="todos">Todas as Modalidades</option>
                  {derivedModalidades.map(mod => (
                    <option key={mod} value={mod}>{mod}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {turmas.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/60 p-12 text-center space-y-3">
              <span className="text-4xl">⚽</span>
              <h3 className="font-bold text-slate-800">Nenhuma turma disponível no momento</h3>
              <p className="text-slate-400 text-xs max-w-sm mx-auto">Novas turmas serão abertas em breve. Para informações ou lista de interesse, fale no nosso WhatsApp.</p>
            </div>
          ) : filteredTurmas.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/60 p-12 text-center space-y-3">
              <span className="text-4xl">🔍</span>
              <h3 className="font-bold text-slate-800">Nenhuma turma encontrada</h3>
              <p className="text-slate-400 text-xs max-w-sm mx-auto">Não encontramos turmas que atendam aos filtros selecionados para esta unidade.</p>
              <button 
                onClick={() => {
                  setSelectedEscolaridade('todos');
                  setSelectedModalidade('todos');
                }}
                className="mt-4 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-indigo-100"
              >
                Limpar Filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {filteredTurmas.map((t) => {
                const isFull = t.capacidade && (t.ocupacao_atual || 0) >= t.capacidade;
                const allowedSeries = Array.isArray(t.series_permitidas) 
                  ? t.series_permitidas.join(', ') 
                  : (typeof t.series_permitidas === 'string' 
                    ? t.series_permitidas.split(',').map(s => s.trim()).join(', ') 
                    : '');

                return (
                  <motion.div 
                    key={t.id}
                    id={`turma-${t.id}`}
                    whileHover={{ y: -3 }}
                    className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col hover:border-indigo-200 hover:shadow-md transition-all scroll-mt-6"
                  >
                    {/* Class Banner Image */}
                    <div className="w-full aspect-square bg-slate-100 relative">
                      {t.imagem_url ? (
                        <img src={t.imagem_url} alt={t.nome} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white text-3xl font-black">
                          🏆
                        </div>
                      )}
                      
                      {/* Vagas Badge */}
                      <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${
                        isFull 
                          ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                          : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}>
                        {t.capacidade 
                          ? (isFull 
                              ? `Sem vagas (0/${t.capacidade})` 
                              : `Vagas: ${t.capacidade - (t.ocupacao_atual || 0)}/${t.capacidade}`)
                          : (isFull ? 'Lista de Espera' : 'Vagas Abertas')}
                      </span>
                    </div>

                    {/* Class info */}
                    <div className="flex-1 p-6 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex items-start gap-2">
                            <h3 className="font-black text-slate-800 text-lg tracking-tight leading-none">{t.nome}</h3>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(`https://www.sportforkids.com.br/portal/${unidadeSlug}/turma/${t.id}`);
                                toast.success('Link da turma copiado para compartilhamento!');
                              }}
                              className="text-slate-400 hover:text-indigo-600 transition-colors"
                              title="Copiar link da turma"
                            >
                              <Share2 size={16} />
                            </button>
                          </div>
                          <span className="text-sm font-black text-slate-900 shrink-0">
                            R$ {(t.precos_unidade?.[unidade?.nome || ''] ?? t.valor_mensalidade)?.toFixed(2)}<span className="text-[10px] text-slate-400 font-normal">/mês</span>
                          </span>
                        </div>

                        {/* Series restriction tag */}
                        {allowedSeries && (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg self-start inline-block">
                            <GraduationCap size={12} className="text-indigo-600" />
                            <span>Público: {allowedSeries}</span>
                          </div>
                        )}

                        {t.descricao && (
                          <p className="text-slate-500 text-xs leading-relaxed line-clamp-3 pt-1">{t.descricao}</p>
                        )}
                      </div>

                      {/* Class timing and professor info */}
                      <div className="space-y-2.5 pt-3 border-t border-slate-50 text-[11px] text-slate-600">
                        <div className="flex items-center gap-2">
                          <CalendarDays size={14} className="text-indigo-500" />
                          <span>{t.dias_horarios}</span>
                        </div>
                        {t.local_aula && (
                          <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-indigo-500" />
                            <span>Local: {t.local_aula}</span>
                          </div>
                        )}
                        {t.capacidade > 0 && (
                          <div className="flex items-center gap-2">
                            <Users size={14} className="text-indigo-500" />
                            <span>Vagas: <strong>{Math.max(0, t.capacidade - (t.ocupacao_atual || 0))}</strong> de <strong>{t.capacidade}</strong> disponíveis</span>
                          </div>
                        )}
                        {t.professor && (
                          <div className="flex items-center gap-2 pt-1">
                            {t.foto_professor_url ? (
                              <img src={t.foto_professor_url} alt={t.professor} className="w-5 h-5 rounded-full object-cover border" />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] text-slate-500 font-bold">P</div>
                            )}
                            <span>Professor(a): <strong>{t.professor}</strong></span>
                          </div>
                        )}
                      </div>

                      {/* Class Actions */}
                      <div className="flex gap-2 pt-2">
                        <button 
                          onClick={() => handleAction('matricula', t)}
                          className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold rounded-xl text-xs transition-colors"
                        >
                          Matricular
                        </button>
                        <button 
                          onClick={() => handleAction('experimental', t)}
                          className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-bold rounded-xl text-xs transition-colors"
                        >
                          Agendar Experimental
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
