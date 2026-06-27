import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Play, ArrowRight, ShieldCheck, Star, Users, MapPin, Send, MessageCircle, ExternalLink, Quote, LogOut, User } from 'lucide-react';
import LoginModal from '../components/LoginModal';
import toast from 'react-hot-toast';
import { usePageAnalytics } from '../hooks/usePageAnalytics';

interface LandingPageProps {
  onStartEnrollment: (unidadePref?: string) => void;
  onLoginSuccess: (data: any) => void;
  logoUrl?: string;
  brandName?: string;
}

export default function LandingPage({ onStartEnrollment, onLoginSuccess, logoUrl, brandName }: LandingPageProps) {
  usePageAnalytics('/', 'Página Inicial');

  useEffect(() => {
    document.title = "Sport for Kids — Praticar Esporte é Fazer Amigos";
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action') || urlParams.get('acao');
    if (action === 'trial' || action === 'experimental' || action === 'enroll' || action === 'enrollment' || action === 'matricula') {
      const stored = localStorage.getItem('guardian');
      if (stored) {
        try {
          onLoginSuccess(JSON.parse(stored));
        } catch (e) {
          setIsLoginModalOpen(true);
        }
      } else {
        setIsLoginModalOpen(true);
      }
    }
  }, [onLoginSuccess]);

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(true);
  const [configs, setConfigs] = useState({
    banner_title: 'O esporte que transforma o futuro do seu filho',
    banner_subtitle: 'Desenvolvimento físico, social e emocional através do esporte com metodologia exclusiva.',
    banner_url: 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?q=80&w=2000&auto=format&fit=crop',
    video_url: '',
    header_logo_url: '',
    header_logo_size: 'h-16',
    hero_carousel: [] as any[],
    hero_transition_time: 5,
    units_section: [] as any[],
    testimonials: [] as any[],
    testimonials_speed: null as number | null
  });

  const [currentSlide, setCurrentSlide] = useState(0);
  const [testimArray, setTestimArray] = useState<any[]>([]);

  useEffect(() => {
    if (configs.testimonials && configs.testimonials.length > 0) {
      setTestimArray(configs.testimonials.map((t: any, i: number) => ({ ...t, _id: i })));
    }
  }, [configs.testimonials]);

  useEffect(() => {
    if (testimArray.length > 3) {
      const interval = setInterval(() => {
        setTestimArray(prev => {
          const newArray = [...prev];
          const first = newArray.shift();
          if (first) newArray.push(first);
          return newArray;
        });
      }, (configs.testimonials_speed || 30) * 1000);
      return () => clearInterval(interval);
    }
  }, [testimArray.length, configs.testimonials_speed]);

  const [leadForm, setLeadForm] = useState({ nome: '', email: '', whatsapp: '' });
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);
  const [unidades, setUnidades] = useState<any[]>([]);
  const [guardian, setGuardian] = useState<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem('guardian');
    if (stored) {
      try {
        setGuardian(JSON.parse(stored));
      } catch (e) {}
    }
    const fetchConfigs = async () => {
      try {
        const res = await fetch('/api/website-configs');
        if (res.ok) {
          const data = await res.json();
          if (data && !data.error) {
            setConfigs({
              banner_title: data.banner_title || configs.banner_title,
              banner_subtitle: data.banner_subtitle || configs.banner_subtitle,
              banner_url: data.banner_url || configs.banner_url,
              video_url: data.video_url || '',
              header_logo_url: data.header_logo_url || '',
              header_logo_size: data.header_logo_size || 'h-16',
              hero_carousel: Array.isArray(data.hero_carousel) ? data.hero_carousel : [],
              hero_transition_time: data.hero_transition_time || 5,
              units_section: Array.isArray(data.units_section) ? data.units_section : [],
              testimonials: Array.isArray(data.testimonials) ? data.testimonials : [],
              testimonials_speed: data.testimonials_speed || null
            });
          }
        }
      } catch (err) {
        console.error('Failed to load website configs', err);
      }
    };

    const fetchUnidades = async () => {
      try {
        const res = await fetch('/api/options');
        if (res.ok) {
          const data = await res.json();
          if (data && data.unidades) {
            setUnidades(data.unidades);
          }
        }
      } catch (err) {
        console.error('Failed to load unidades', err);
      }
    };

    Promise.all([fetchConfigs(), fetchUnidades()]).finally(() => {
      setIsLoadingConfigs(false);
    });
  }, []);

  // Carousel Auto-Play Effect
  useEffect(() => {
    if (configs.hero_carousel && configs.hero_carousel.length > 1) {
      const interval = setInterval(() => {
        setCurrentSlide(prev => (prev + 1) % configs.hero_carousel.length);
      }, configs.hero_transition_time * 1000);
      return () => clearInterval(interval);
    }
  }, [configs.hero_carousel, configs.hero_transition_time]);

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadForm.nome || !leadForm.email || !leadForm.whatsapp) {
      toast.error('Preencha todos os campos.');
      return;
    }
    setIsSubmittingLead(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadForm)
      });
      if (res.ok) {
        toast.success('Mensagem enviada! Em breve entraremos em contato.');
        setLeadForm({ nome: '', email: '', whatsapp: '' });
      } else {
        toast.error('Erro ao enviar mensagem.');
      }
    } catch (err) {
      toast.error('Erro de conexão.');
    } finally {
      setIsSubmittingLead(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('guardian');
    setGuardian(null);
    toast.success('Desconectado com sucesso');
  };

  if (isLoadingConfigs) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-500 selection:text-white">
      {/* NavBar Glassmorphism */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-lg border-b border-white/50 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-6 min-h-[5rem] py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer">
            {configs.header_logo_url ? (
              <img src={configs.header_logo_url} alt={brandName || 'Logo'} className={`${configs.header_logo_size || 'h-16'} object-contain transition-all`} />
            ) : logoUrl ? (
              <img src={logoUrl} alt={brandName || 'Logo'} className={`${configs.header_logo_size || 'h-16'} object-contain transition-all`} />
            ) : (
              <>
                <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl shadow-lg shadow-indigo-200">
                  <ShieldCheck className="text-white" size={24} />
                </div>
                <h1 className="text-xl font-black tracking-tight text-slate-800 hidden sm:block">
                  {brandName || 'Sport for Kids'}
                </h1>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {guardian ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-slate-700 bg-slate-50 px-4 py-2 rounded-full border border-slate-200">
                  <div className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-xs">
                    {guardian.nome_completo?.charAt(0)}
                  </div>
                  <span className="text-sm font-bold truncate max-w-[120px] sm:max-w-[200px]">
                    {guardian.nome_completo?.split(' ')[0]}
                  </span>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  title="Sair"
                >
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <>
                <Link 
                  to="/tutoriais"
                  className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors hidden sm:block"
                >
                  Ajuda e Tutoriais
                </Link>
                <button 
                  onClick={() => setIsLoginModalOpen(true)}
                  className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors hidden sm:block"
                >
                  Área do Aluno
                </button>
                <button 
                  onClick={() => setIsLoginModalOpen(true)}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-sm font-bold transition-all shadow-lg shadow-slate-200 flex items-center gap-2 group"
                >
                  Novo cadastro
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)} 
        onLoginSuccess={onLoginSuccess} 
        unidades={unidades}
      />

      {/* Hero Section Split-Screen ou Carrossel */}
      <section className="pt-24 pb-10 px-6 min-h-[70vh] flex items-center relative overflow-hidden">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-100/50 blur-3xl mix-blend-multiply" />
          <div className="absolute top-[20%] -right-[10%] w-[40%] h-[60%] rounded-full bg-purple-100/50 blur-3xl mix-blend-multiply" />
        </div>

        <div className="max-w-7xl mx-auto w-full relative">
          {configs.hero_carousel && configs.hero_carousel.length > 0 ? (
            <div className="relative w-full h-full min-h-[600px] flex items-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSlide}
                  initial={{ opacity: 0, x: 100 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                  className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center w-full"
                >
                  <div className="space-y-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-wider">
                      <Star size={14} className="text-indigo-500 fill-indigo-500" />
                      Metodologia Premium
                    </div>
                    
                    <h2 className="text-5xl md:text-6xl font-black text-slate-900 leading-[1.1] tracking-tight">
                      {(configs.hero_carousel[currentSlide].title || '').split(' ').map((word: string, i: number) => (
                        <span key={i} className={i % 3 === 0 ? 'text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600' : ''}>
                          {word}{' '}
                        </span>
                      ))}
                    </h2>
                    
                    <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-lg font-medium">
                      {configs.hero_carousel[currentSlide].subtitle}
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                      <button 
                        onClick={() => setIsLoginModalOpen(true)}
                        className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-[0_8px_30px_rgb(79,70,229,0.3)] flex items-center justify-center gap-2 group text-lg"
                      >
                        Novo Cadastro
                        <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                      </button>
                      
                      <button 
                        onClick={() => {
                          document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 text-lg shadow-sm"
                      >
                        Falar com a Equipe
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <div className="aspect-[4/3] rounded-[2.5rem] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border-[8px] border-white/50 relative group">
                      <img 
                        src={configs.hero_carousel[currentSlide].image_url} 
                        alt="Banner" 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Indicadores do Carrossel */}
              <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex gap-2">
                {configs.hero_carousel.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentSlide(idx)}
                    className={`h-2 rounded-full transition-all ${currentSlide === idx ? 'w-8 bg-indigo-600' : 'w-2 bg-indigo-200 hover:bg-indigo-400'}`}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* Fallback Clássico */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <motion.div 
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="space-y-8"
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-wider">
                  <Star size={14} className="text-indigo-500 fill-indigo-500" />
                  Metodologia Premium
                </div>
                
                <h2 className="text-5xl md:text-6xl font-black text-slate-900 leading-[1.1] tracking-tight">
                  {configs.banner_title.split(' ').map((word, i) => (
                    <span key={i} className={i % 3 === 0 ? 'text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600' : ''}>
                      {word}{' '}
                    </span>
                  ))}
                </h2>
                
                <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-lg font-medium">
                  {configs.banner_subtitle}
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <button 
                    onClick={() => setIsLoginModalOpen(true)}
                    className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-[0_8px_30px_rgb(79,70,229,0.3)] flex items-center justify-center gap-2 group text-lg"
                  >
                    Novo Cadastro
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                  
                  <button 
                    onClick={() => {
                      document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 text-lg shadow-sm"
                  >
                    Falar com a Equipe
                  </button>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, scale: 0.9, rotate: 2 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                className="relative"
              >
                <div className="aspect-[4/3] rounded-[2.5rem] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border-[8px] border-white/50 relative group">
                  <img 
                    src={configs.banner_url} 
                    alt="Banner" 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  {configs.video_url && (
                    <div className="absolute inset-0 bg-slate-900/20 flex items-center justify-center backdrop-blur-[2px] group-hover:backdrop-blur-0 transition-all">
                      <a href={configs.video_url} target="_blank" rel="noreferrer" className="w-20 h-20 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform cursor-pointer">
                        <Play className="text-indigo-600 ml-1" size={32} fill="currentColor" />
                      </a>
                    </div>
                  )}
                </div>
                
                {/* Floating Badge */}
                <motion.div 
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                  className="absolute -bottom-6 -left-6 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-white flex items-center gap-4"
                >
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Users className="text-green-600" size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase">Alunos Ativos</p>
                    <p className="text-xl font-black text-slate-800">+500 famílias</p>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          )}
        </div>
      </section>

      {/* Unidades (Portais) */}
      {unidades && unidades.length > 0 && (
        <section className="py-24 bg-white relative">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h3 className="text-3xl font-black text-slate-900 mb-4">Acesse as informações da unidade de sua preferencia</h3>
              <p className="text-slate-500 text-lg">Selecione o portal da unidade abaixo para fazer agendamento em aulas experimentais, gestão de matrículas, acessar a loja de uniformes ou inscrição em eventos.</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {unidades.filter(u => typeof u === 'object' && u.nome).map((unit: any, idx: number) => (
                <motion.a 
                  key={idx}
                  href={`/portal/${unit.slug || unit.nome.toLowerCase().replace(/\\s+/g, '-')}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group flex flex-col items-center text-center gap-6 cursor-pointer"
                >
                  <div className="w-full flex justify-between items-start">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${unit.access_type === 'Restrito a alunos' ? 'bg-indigo-100 text-indigo-700' : 'bg-green-100 text-green-700'}`}>
                      {unit.access_type || 'Restrito a alunos'}
                    </span>
                    <ExternalLink className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                  </div>
                  
                  {unit.logo_url ? (
                    <img src={unit.logo_url} alt={unit.nome} className="h-16 object-contain" />
                  ) : (
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                      <MapPin className="w-8 h-8 text-slate-400" />
                    </div>
                  )}
                  
                  <div className="space-y-2 w-full">
                    <h4 className="text-xl font-bold text-slate-800">{unit.nome}</h4>
                    <span className="text-indigo-600 font-medium text-sm flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      Acessar Portal <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </motion.a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Diferenciais */}
      <section className="py-24 bg-white relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h3 className="text-3xl font-black text-slate-900 mb-4">Muito além do esporte</h3>
            <p className="text-slate-500 text-lg">Nosso compromisso é com a formação integral, unindo disciplina, saúde e diversão em um ambiente seguro.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: ShieldCheck, title: "Ambiente Seguro", desc: "Profissionais qualificados e estrutura de primeira linha para a segurança do seu filho.", color: "text-blue-600", bg: "bg-blue-50" },
              { icon: Star, title: "Metodologia Exclusiva", desc: "Aulas lúdicas que desenvolvem habilidades motoras, cognitivas e sociais.", color: "text-amber-600", bg: "bg-amber-50" },
              { icon: MapPin, title: "Fácil Acesso", desc: "Unidades bem localizadas e horários flexíveis que se adaptam à rotina da sua família.", color: "text-purple-600", bg: "bg-purple-50" }
            ].map((item, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="p-8 rounded-3xl bg-slate-50 hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 transition-all border border-transparent hover:border-slate-100 group"
              >
                <div className={`w-14 h-14 ${item.bg} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <item.icon className={item.color} size={28} />
                </div>
                <h4 className="text-xl font-bold text-slate-800 mb-3">{item.title}</h4>
                <p className="text-slate-600 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Depoimentos */}
      {configs.testimonials && configs.testimonials.length > 0 && (
        <section className="py-24 bg-slate-50 relative">
          <div className="max-w-7xl mx-auto px-6 mb-12">
            <div className="text-center max-w-2xl mx-auto">
              <h3 className="text-3xl font-black text-slate-900 mb-4">O que famílias, parceiros e alunos dizem</h3>
              <p className="text-slate-500 text-lg">Histórias reais de quem vive o esporte com a nossa metodologia e acompanha nossa trajetória.</p>
            </div>
          </div>
            
          <div className="w-full overflow-hidden relative pb-8">
            <div className="flex gap-8 px-4 justify-start min-w-max mx-auto max-w-7xl">
              <AnimatePresence mode="popLayout">
                {testimArray.slice(0, 3).map((testim: any) => (
                  <motion.div 
                    layout
                    key={testim._id}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50, scale: 0.95 }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                    className="w-[350px] shrink-0 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative"
                  >
                    <Quote className="absolute top-6 right-6 w-8 h-8 text-indigo-100" />
                    <div className="flex gap-1 mb-6">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-4 h-4 ${i < (testim.rating || 5) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'}`} />
                      ))}
                    </div>
                    <p className="text-slate-600 leading-relaxed mb-8 italic whitespace-normal">"{testim.text}"</p>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-lg shrink-0">
                        {testim.name.charAt(0)}
                      </div>
                      <div className="overflow-hidden">
                        <h5 className="font-bold text-slate-800 truncate">{testim.name}</h5>
                        <p className="text-xs text-slate-500 uppercase tracking-wider truncate">{testim.role}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </section>
      )}

      {/* Leads / Contact Section */}
      <section id="contato" className="py-24 relative bg-slate-900 overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-indigo-900/50 to-transparent pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-6 relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6 text-white">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-xs font-bold uppercase tracking-wider">
              <MessageCircle size={14} />
              Fale Conosco
            </div>
            <h3 className="text-4xl md:text-5xl font-black leading-tight">
              Ainda tem dúvidas? <br/>
              <span className="text-indigo-400">Nós ajudamos você.</span>
            </h3>
            <p className="text-slate-300 text-lg max-w-md">
              Deixe seu contato e nossa equipe de atendimento retornará rapidamente via WhatsApp ou E-mail com todas as informações.
            </p>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-2xl">
            <h4 className="text-2xl font-bold text-slate-800 mb-6">Envie sua mensagem</h4>
            <form onSubmit={handleLeadSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nome Completo</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-900"
                  placeholder="Seu nome"
                  value={leadForm.nome}
                  onChange={e => setLeadForm({...leadForm, nome: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">E-mail</label>
                <input 
                  type="email" 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-900"
                  placeholder="seu@email.com"
                  value={leadForm.email}
                  onChange={e => setLeadForm({...leadForm, email: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">WhatsApp</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-900"
                  placeholder="(11) 99999-9999"
                  value={leadForm.whatsapp}
                  onChange={e => setLeadForm({...leadForm, whatsapp: e.target.value})}
                />
              </div>
              <button 
                type="submit"
                disabled={isSubmittingLead}
                className="w-full py-4 mt-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-lg transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
              >
                {isSubmittingLead ? 'Enviando...' : (
                  <>
                    Enviar Contato
                    <Send size={18} />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="bg-slate-950 py-12 text-center border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-sm font-medium">
            © {new Date().getFullYear()} {brandName || 'Sport for Kids'}. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-6">
            <Link to="/tutoriais" className="text-slate-400 hover:text-white text-sm font-bold transition-colors">
              Central de Ajuda (Tutoriais)
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
