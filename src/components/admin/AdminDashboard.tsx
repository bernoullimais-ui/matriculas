import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { Users, UserCheck, UserX, UserPlus, DollarSign, TrendingUp, TrendingDown, Clock, Activity, Calendar, Package, AlertCircle, ArrowRightLeft } from 'lucide-react';

interface DashboardData {
  metrics: {
    alunosAtivos: number;
    matriculasAtivas: number;
    inadimplentes: number;
    receitaMes: number;
    matriculasMes: number;
    cancelamentosMes: number;
    transferidosMes: number;
  };
  charts: {
    name: string;
    receita: number;
    matriculas: number;
  }[];
  feed: {
    id: string;
    tipo: string;
    descricao: string;
    detalhe: string;
    data: string;
  }[];
}

export const AdminDashboard = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole] = useState<'master' | 'administrativo'>(() => {
    return (sessionStorage.getItem('admin_role') as any) || 'master';
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = sessionStorage.getItem('admin_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await fetch('/api/admin/dashboard', { headers });
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error('Erro ao buscar dados do dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!data) return <div className="text-slate-500">Erro ao carregar dados do dashboard.</div>;

  const { metrics, charts, feed } = data;

  const MetricCard = ({ title, value, icon: Icon, colorClass, subtitle }: any) => (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl ${colorClass}`}>
          <Icon size={24} />
        </div>
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">{title}</h3>
        <div className="text-3xl font-black text-slate-800">{value}</div>
        {subtitle && <p className="text-xs font-semibold text-slate-400 mt-2">{subtitle}</p>}
      </div>
    </div>
  );

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Metrics Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Alunos Ativos" 
          value={metrics.alunosAtivos} 
          icon={Users} 
          colorClass="bg-indigo-50 text-indigo-600"
          subtitle="Total de alunos matriculados"
        />
        <MetricCard 
          title="Matrículas Ativas" 
          value={metrics.matriculasAtivas} 
          icon={UserCheck} 
          colorClass="bg-emerald-50 text-emerald-600"
          subtitle="Total de matrículas ativas"
        />
        <MetricCard 
          title="Alunos Inadimplentes" 
          value={metrics.inadimplentes} 
          icon={UserX} 
          colorClass="bg-rose-50 text-rose-600"
          subtitle="Com falha no pagamento"
        />
        {userRole === 'master' && (
          <MetricCard 
            title="Receita do Mês" 
            value={formatCurrency(metrics.receitaMes)} 
            icon={DollarSign} 
            colorClass="bg-blue-50 text-blue-600"
            subtitle="Total recebido este mês"
          />
        )}
      </div>

      {/* Metrics Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Novas Matrículas (Mês)</h3>
            <div className="text-3xl font-black text-slate-800">{metrics.matriculasMes}</div>
          </div>
          <div className="p-4 bg-emerald-50 rounded-full text-emerald-600">
            <TrendingUp size={32} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Transferidos (Mês)</h3>
            <div className="text-3xl font-black text-slate-800">{metrics.transferidosMes}</div>
          </div>
          <div className="p-4 bg-amber-50 rounded-full text-amber-600">
            <ArrowRightLeft size={32} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Cancelamentos (Mês)</h3>
            <div className="text-3xl font-black text-slate-800">{metrics.cancelamentosMes}</div>
          </div>
          <div className="p-4 bg-rose-50 rounded-full text-rose-600">
            <TrendingDown size={32} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Charts */}
        <div className="lg:col-span-2 space-y-6">
          {userRole === 'master' && (
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-6">Receita Diária (Mês Atual)</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={charts} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} tickFormatter={(value) => `R$${value}`} />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Receita']}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Area type="monotone" dataKey="receita" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorReceita)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Novas Matrículas por Dia (Mês Atual)</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} allowDecimals={false} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="matriculas" name="Matrículas" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm h-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800">Feed de Atividades</h3>
            <Activity className="text-slate-400" size={20} />
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-6">
            {feed.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-10">Nenhuma atividade recente.</p>
            ) : (
              <div className="relative border-l-2 border-slate-100 ml-4 space-y-8">
                {feed.map((item, idx) => {
                  let Icon = Clock;
                  let iconColor = 'bg-slate-100 text-slate-500';
                  
                  if (item.tipo === 'matricula') {
                    Icon = TrendingUp;
                    iconColor = 'bg-emerald-100 text-emerald-600';
                  } else if (item.tipo === 'cancelamento') {
                    Icon = TrendingDown;
                    iconColor = 'bg-rose-100 text-rose-600';
                  } else if (item.tipo === 'falha_pagamento') {
                    Icon = AlertCircle;
                    iconColor = 'bg-orange-100 text-orange-600';
                  } else if (item.tipo === 'loja') {
                    Icon = Package;
                    iconColor = 'bg-blue-100 text-blue-600';
                  } else if (item.tipo === 'transferencia') {
                    Icon = ArrowRightLeft;
                    iconColor = 'bg-amber-100 text-amber-600';
                  } else if (item.tipo === 'evento') {
                    Icon = Calendar;
                    iconColor = 'bg-purple-100 text-purple-600';
                  } else if (item.tipo === 'cadastro') {
                    Icon = UserPlus;
                    iconColor = 'bg-teal-100 text-teal-600';
                  }

                  const date = new Date(item.data);
                  const isToday = date.toDateString() === new Date().toDateString();
                  const timeString = isToday 
                    ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div key={item.id + idx} className="relative pl-6">
                      <div className={`absolute -left-3.5 top-0 w-7 h-7 rounded-full flex items-center justify-center border-4 border-white ${iconColor}`}>
                        <Icon size={12} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{item.descricao}</p>
                        {item.detalhe && <p className="text-xs text-slate-500 mt-1">{item.detalhe}</p>}
                        <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-wider">{timeString}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
