import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, ShoppingBag, Calendar, DollarSign, Building2, Settings, LogOut, ChevronDown, ChevronRight, Menu, X, UserCog, ClipboardList, Clock, MessageSquare, Package, Tags, Ticket, Receipt, FileText, Calculator, BarChart3
} from 'lucide-react';

import { useAdminStore } from '../../stores/adminStore';

import { AdminDashboard } from '../../components/admin/AdminDashboard';
import AnalyticsTab from '../../components/admin/AnalyticsTab';
import TasksTab from '../../components/admin/crm/TasksTab';
import EnrollmentsTab from '../../components/admin/crm/EnrollmentsTab';
import WaitlistTab from '../../components/admin/crm/WaitlistTab';
import { LeadsTab } from '../../components/admin/LeadsTab';
import { FinanceTab } from '../../components/admin/FinanceTab';
import { EventosTab } from '../../components/admin/courses/EventosTab';
import { InscricoesTab } from '../../components/admin/courses/InscricoesTab';
import { CuponsTab } from '../../components/admin/courses/CuponsTab';
import { ProdutosTab } from '../../components/admin/ecommerce/ProdutosTab';
import { CategoriasTab } from '../../components/admin/ecommerce/CategoriasTab';
import { PedidosTab } from '../../components/admin/ecommerce/PedidosTab';
import ContratosEquipeTab from '../../components/admin/rh/ContratosEquipeTab';
import FolhaPagamentoTab from '../../components/admin/rh/FolhaPagamentoTab';
import { RegrasB2BTab } from '../../components/admin/b2b/RegrasB2BTab';
import { ConciliacaoB2BTab } from '../../components/admin/b2b/ConciliacaoB2BTab';
import SettingsTab from '../../components/admin/settings/SettingsTab';
import toast from 'react-hot-toast';

export default function UnifiedAdmin() {
  const { tab, setTab, loadData } = useAdminStore();
  const [isLogged, setIsLogged] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [menuOpen, setMenuOpen] = useState({
    crm: true,
    loja: false,
    cursos: false,
    rh: false,
    b2b: false
  });
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = sessionStorage.getItem('admin_token');
    if (token) {
      setIsLogged(true);
      loadData();
    }
  }, [loadData]);

  const [email, setEmail] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (res.ok) {
        const data = await res.json();
        sessionStorage.setItem('admin_token', data.token);
        sessionStorage.setItem('admin_role', data.role);
        setIsLogged(true);
        loadData();
      } else {
        toast.error('E-mail ou senha incorretos!');
      }
    } catch {
      toast.error('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_token');
    sessionStorage.removeItem('admin_role');
    setIsLogged(false);
    navigate('/gestao');
  };

  const toggleMenu = (menu: keyof typeof menuOpen) => {
    setMenuOpen(prev => ({ ...prev, [menu]: !prev[menu] }));
  };

  if (!isLogged) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-100">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center">
              <Users className="text-white" size={32} />
            </div>
          </div>
          <h2 className="text-2xl font-black text-center text-slate-800 mb-2">Acesso Restrito</h2>
          <p className="text-center text-slate-500 mb-8 text-sm">Faça login com seu e-mail e senha administrativa</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Seu e-mail"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
              />
            </div>
            <div>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Sua senha"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-200"
            >
              {loading ? 'Verificando...' : 'Entrar no Sistema'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const userRole = sessionStorage.getItem('admin_role') || 'administrativo';

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden text-slate-800">
      {/* Sidebar */}
      <aside className={`\${sidebarOpen ? 'w-64' : 'w-0 lg:w-64'} fixed lg:relative z-40 h-screen bg-slate-900 text-slate-300 transition-all duration-300 flex flex-col overflow-y-auto`}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-sm">SFK</span>
            </div>
            <span className="text-white font-bold text-lg tracking-tight">Painel Admin</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 pb-6 space-y-1">
          <button onClick={() => setTab('dashboard')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors \${tab === 'dashboard' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}>
            <LayoutDashboard size={18} /> <span className="font-semibold text-sm">Dashboard</span>
          </button>
          
          {userRole === 'master' && (
            <button onClick={() => setTab('analytics')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors \${tab === 'analytics' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}>
              <BarChart3 size={18} /> <span className="font-semibold text-sm">Analytics</span>
            </button>
          )}

          {userRole === 'master' && (
            <button onClick={() => setTab('finance')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors \${tab === 'finance' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}>
              <DollarSign size={18} /> <span className="font-semibold text-sm">Financeiro</span>
            </button>
          )}

          {/* CRM */}
          <div className="pt-4 pb-1">
            <button onClick={() => toggleMenu('crm')} className="w-full flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider px-3 transition-colors hover:text-slate-300">
              <div className="flex items-center gap-2"><Users size={14} /> Gestão de Alunos</div>
              {menuOpen.crm ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {menuOpen.crm && (
              <div className="mt-2 ml-4 pl-4 border-l border-slate-700 space-y-1">
                <button onClick={() => setTab('enrollments')} className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors \${tab === 'enrollments' ? 'bg-slate-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>Matrículas</button>
                <button onClick={() => setTab('tasks')} className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors \${tab === 'tasks' ? 'bg-slate-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>Aprovações</button>
                <button onClick={() => setTab('waitlist')} className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors \${tab === 'waitlist' ? 'bg-slate-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>Fila de Espera</button>
                <button onClick={() => setTab('leads')} className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors \${tab === 'leads' ? 'bg-slate-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>Fale Conosco</button>
              </div>
            )}
          </div>

          {/* Loja */}
          <div className="pt-2 pb-1">
            <button onClick={() => toggleMenu('loja')} className="w-full flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider px-3 transition-colors hover:text-slate-300">
              <div className="flex items-center gap-2"><ShoppingBag size={14} /> Loja</div>
              {menuOpen.loja ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {menuOpen.loja && (
              <div className="mt-2 ml-4 pl-4 border-l border-slate-700 space-y-1">
                <button onClick={() => setTab('pedidos')} className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors \${tab === 'pedidos' ? 'bg-slate-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>Pedidos</button>
                <button onClick={() => setTab('produtos')} className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors \${tab === 'produtos' ? 'bg-slate-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>Produtos</button>
                <button onClick={() => setTab('categorias')} className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors \${tab === 'categorias' ? 'bg-slate-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>Categorias</button>
              </div>
            )}
          </div>

          {/* Cursos e Eventos */}
          <div className="pt-2 pb-1">
            <button onClick={() => toggleMenu('cursos')} className="w-full flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider px-3 transition-colors hover:text-slate-300">
              <div className="flex items-center gap-2"><Calendar size={14} /> Cursos / Eventos</div>
              {menuOpen.cursos ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {menuOpen.cursos && (
              <div className="mt-2 ml-4 pl-4 border-l border-slate-700 space-y-1">
                <button onClick={() => setTab('eventos')} className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors \${tab === 'eventos' ? 'bg-slate-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>Eventos</button>
                <button onClick={() => setTab('inscricoes')} className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors \${tab === 'inscricoes' ? 'bg-slate-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>Inscrições</button>
                <button onClick={() => setTab('cupons')} className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors \${tab === 'cupons' ? 'bg-slate-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>Cupons</button>
              </div>
            )}
          </div>

          {/* B2B */}
          {userRole === 'master' && (
            <div className="pt-2 pb-1">
              <button onClick={() => toggleMenu('b2b')} className="w-full flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider px-3 transition-colors hover:text-slate-300">
                <div className="flex items-center gap-2"><Building2 size={14} /> Escolas Parceiras</div>
                {menuOpen.b2b ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              {menuOpen.b2b && (
                <div className="mt-2 ml-4 pl-4 border-l border-slate-700 space-y-1">
                  <button onClick={() => setTab('b2b_regras')} className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors \${tab === 'b2b_regras' ? 'bg-slate-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>Regras de Repasse</button>
                  <button onClick={() => setTab('b2b_conciliacao')} className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors \${tab === 'b2b_conciliacao' ? 'bg-slate-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>Conciliação</button>
                </div>
              )}
            </div>
          )}

          {/* RH */}
          {userRole === 'master' && (
            <div className="pt-2 pb-1">
              <button onClick={() => toggleMenu('rh')} className="w-full flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider px-3 transition-colors hover:text-slate-300">
                <div className="flex items-center gap-2"><UserCog size={14} /> Recursos Humanos</div>
                {menuOpen.rh ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              {menuOpen.rh && (
                <div className="mt-2 ml-4 pl-4 border-l border-slate-700 space-y-1">
                  <button onClick={() => setTab('rh_contratos')} className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors \${tab === 'rh_contratos' ? 'bg-slate-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>Contratos & Equipe</button>
                  <button onClick={() => setTab('rh_folha')} className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors \${tab === 'rh_folha' ? 'bg-slate-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>Folha de Pagamento</button>
                </div>
              )}
            </div>
          )}

          {userRole === 'master' && (
            <div className="pt-4 mt-4 border-t border-slate-800">
              <button onClick={() => setTab('settings')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors \${tab === 'settings' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}>
                <Settings size={18} /> <span className="font-semibold text-sm">Configurações</span>
              </button>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2 text-sm">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold uppercase">
              {userRole[0]}
            </div>
            <div className="flex-1">
              <p className="text-white font-bold capitalize">{userRole}</p>
              <p className="text-xs text-slate-500">Administrador</p>
            </div>
            <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 relative">
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0 lg:hidden z-30">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-slate-500 hover:bg-slate-50 rounded-xl">
              <Menu size={24} />
            </button>
            <span className="font-bold text-slate-800">Painel SFK</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-[1600px] mx-auto">
            {tab === 'dashboard' && <AdminDashboard />}
            {tab === 'analytics' && <AnalyticsTab />}
            {tab === 'finance' && <FinanceTab />}
            {tab === 'tasks' && <TasksTab />}
            {tab === 'enrollments' && <EnrollmentsTab />}
            {tab === 'waitlist' && <WaitlistTab />}
            {tab === 'leads' && <LeadsTab />}
            {tab === 'eventos' && <EventosTab />}
            {tab === 'inscricoes' && <InscricoesTab />}
            {tab === 'cupons' && <CuponsTab />}
            {tab === 'produtos' && <ProdutosTab />}
            {tab === 'categorias' && <CategoriasTab />}
            {tab === 'pedidos' && <PedidosTab />}
            {tab === 'rh_contratos' && <ContratosEquipeTab />}
            {tab === 'rh_folha' && <FolhaPagamentoTab />}
            {tab === 'b2b_regras' && <RegrasB2BTab />}
            {tab === 'b2b_conciliacao' && <ConciliacaoB2BTab />}
            {tab === 'settings' && userRole === 'master' && <SettingsTab />}
          </div>
        </div>
      </main>
    </div>
  );
}
