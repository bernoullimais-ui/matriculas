import React, { useState, useEffect } from 'react';
import { Users, Eye, Target, TrendingUp, Smartphone, Monitor, Tablet, Clock, Globe } from 'lucide-react';

interface Resumo {
  visitantes: number;
  pageviews: number;
  taxa_lead: string;
  taxa_compra: string;
  taxa_inscricao: string;
}

interface PaginaStat {
  pagina: string;
  titulo: string;
  views: number;
  tempo_medio: number;
}

interface DispositivoStat {
  dispositivo: string;
  count: number;
  pct: string;
}

interface DiaStat {
  dia: string;
  views: number;
  visitantes: number;
}

interface HoraStat {
  hora: number;
  count: number;
}

interface OrigemStat {
  origem: string;
  count: number;
  pct: string;
}

function formatSegundos(s: number): string {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function MiniLineChart({ data }: { data: DiaStat[] }) {
  if (!data.length) return null;
  const maxViews = Math.max(...data.map(d => d.views), 1);
  const W = 100, H = 40;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - (d.views / maxViews) * H;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-10 text-indigo-500" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pts}
      />
    </svg>
  );
}

export default function AnalyticsTab() {
  const [periodo, setPeriodo] = useState(30);
  const [loading, setLoading] = useState(true);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [paginas, setPaginas] = useState<PaginaStat[]>([]);
  const [dispositivos, setDispositivos] = useState<DispositivoStat[]>([]);
  const [porDia, setPorDia] = useState<DiaStat[]>([]);
  const [porHora, setPorHora] = useState<HoraStat[]>([]);
  const [origens, setOrigens] = useState<OrigemStat[]>([]);

  useEffect(() => {
    const token = sessionStorage.getItem('admin_token');
    const h = token ? { 'Authorization': `Bearer ${token}` } : {};
    const p = `?periodo=${periodo}`;
    setLoading(true);

    Promise.all([
      fetch(`/api/admin/analytics/resumo${p}`, { headers: h }).then(r => r.json()),
      fetch(`/api/admin/analytics/por-pagina${p}`, { headers: h }).then(r => r.json()),
      fetch(`/api/admin/analytics/dispositivos${p}`, { headers: h }).then(r => r.json()),
      fetch(`/api/admin/analytics/por-dia${p}`, { headers: h }).then(r => r.json()),
      fetch(`/api/admin/analytics/por-hora${p}`, { headers: h }).then(r => r.json()),
      fetch(`/api/admin/analytics/origens${p}`, { headers: h }).then(r => r.json()),
    ]).then(([res, pag, disp, dia, hora, orig]) => {
      setResumo(res);
      setPaginas(Array.isArray(pag) ? pag : []);
      setDispositivos(Array.isArray(disp) ? disp : []);
      setPorDia(Array.isArray(dia) ? dia : []);
      setPorHora(Array.isArray(hora) ? hora : []);
      setOrigens(Array.isArray(orig) ? orig : []);
    }).finally(() => setLoading(false));
  }, [periodo]);

  const deviceIcon = (d: string) => {
    if (d === 'mobile') return <Smartphone size={14} />;
    if (d === 'tablet') return <Tablet size={14} />;
    return <Monitor size={14} />;
  };

  const deviceColor = (d: string) => {
    if (d === 'mobile') return 'bg-violet-500';
    if (d === 'tablet') return 'bg-amber-500';
    return 'bg-indigo-500';
  };

  const maxHora = Math.max(...porHora.map(h => h.count), 1);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Period filter */}
      <div className="flex gap-2">
        {[7, 30, 90].map(d => (
          <button
            key={d}
            onClick={() => setPeriodo(d)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              periodo === d ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {d} dias
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Visitantes Únicos', value: resumo?.visitantes?.toLocaleString('pt-BR') || '0', icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Page Views', value: resumo?.pageviews?.toLocaleString('pt-BR') || '0', icon: Eye, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Conversão Lead', value: `${resumo?.taxa_lead || 0}%`, icon: Target, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Conversão Compra', value: `${resumo?.taxa_compra || 0}%`, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Conv. Inscrição', value: `${resumo?.taxa_inscricao || 0}%`, icon: TrendingUp, color: 'text-pink-600', bg: 'bg-pink-50' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
            <div className={`w-8 h-8 ${kpi.bg} rounded-xl flex items-center justify-center mb-2`}>
              <kpi.icon size={16} className={kpi.color} />
            </div>
            <p className="text-xs font-semibold text-slate-400 leading-none">{kpi.label}</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Line chart: acessos por dia */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
        <h3 className="font-bold text-slate-800 text-sm mb-4">Acessos por dia (últimos {periodo} dias)</h3>
        {porDia.length > 0 ? (
          <div>
            <MiniLineChart data={porDia} />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>{porDia[0]?.dia.split('-').slice(1).join('/')}</span>
              <span>{porDia[porDia.length - 1]?.dia.split('-').slice(1).join('/')}</span>
            </div>
          </div>
        ) : (
          <p className="text-slate-400 text-sm text-center py-8">Sem dados ainda para este período</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top pages */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-800 text-sm mb-4">Páginas Mais Visitadas</h3>
          {paginas.length === 0 ? (
            <p className="text-slate-400 text-xs text-center py-6">Nenhum dado ainda</p>
          ) : (
            <div className="space-y-2.5">
              {paginas.map((p, i) => {
                const maxViews = paginas[0].views || 1;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="font-semibold text-slate-700 truncate max-w-[180px]">{p.titulo || p.pagina}</span>
                      <span className="text-slate-500 flex items-center gap-2">
                        <span className="flex items-center gap-0.5"><Clock size={10} />{formatSegundos(p.tempo_medio)}</span>
                        <span className="font-bold text-slate-700">{p.views} views</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full">
                      <div
                        className="h-1.5 bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${(p.views / maxViews) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Devices */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-800 text-sm mb-4">Dispositivos</h3>
          <div className="space-y-3">
            {dispositivos.map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-white ${deviceColor(d.dispositivo)}`}>
                  {deviceIcon(d.dispositivo)}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="font-semibold text-slate-700 capitalize">{d.dispositivo}</span>
                    <span className="font-bold text-slate-700">{d.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full">
                    <div className={`h-1.5 rounded-full ${deviceColor(d.dispositivo)}`} style={{ width: `${d.pct}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Heatmap de hora */}
          <h3 className="font-bold text-slate-800 text-sm mt-6 mb-3">Acessos por Hora do Dia</h3>
          <div className="flex gap-0.5 items-end h-12">
            {porHora.map(h => (
              <div key={h.hora} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                <div
                  className="w-full bg-indigo-400 hover:bg-indigo-600 rounded-sm transition-all cursor-default"
                  style={{ height: `${Math.max(2, (h.count / maxHora) * 40)}px` }}
                  title={`${h.hora}h: ${h.count} acessos`}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[9px] text-slate-400 mt-1">
            <span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>23h</span>
          </div>
        </div>
      </div>

      {/* Origens */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
        <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
          <Globe size={16} className="text-indigo-500" /> Origens de Tráfego
        </h3>
        {origens.length === 0 ? (
          <p className="text-slate-400 text-xs text-center py-6">Nenhum dado ainda</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {origens.map((o, i) => (
              <div key={i} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-xs font-semibold text-slate-500 truncate">{o.origem}</p>
                <p className="text-xl font-black text-slate-800">{o.pct}%</p>
                <p className="text-[10px] text-slate-400">{o.count} acessos</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
