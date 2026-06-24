import React, { useState, useEffect, useCallback } from 'react';
import {
  Megaphone, Plus, Search, Filter, Send, Eye, BarChart3, Archive,
  ChevronRight, ChevronLeft, CheckCircle2, Mail, Globe, Users, X,
  Loader2, TrendingUp, MousePointerClick, UserPlus, ShoppingCart,
  DollarSign, Play, Pause, Edit3, Trash2, ExternalLink, Copy,
  AlertCircle, Clock, Zap, Target, Image as ImageIcon, FileText, Code
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Campaign {
  id: string;
  nome: string;
  slug: string;
  status: 'rascunho' | 'ativa' | 'pausada' | 'arquivada';
  tipo: 'email' | 'landing_page' | 'ambos';
  criado_por?: string;
  data_inicio?: string;
  data_fim?: string;
  agendado_para?: string;
  disparado_em?: string;
  created_at: string;
  updated_at: string;
  targets?: CampaignTarget[];
  email?: CampaignEmail;
  landing_page?: CampaignLandingPage;
  metrics?: CampaignMetrics;
}

interface CampaignTarget {
  id?: string;
  tipo_alvo: 'unidade' | 'turma' | 'inativos' | 'leads';
  valor_alvo?: string;
}

interface CampaignEmail {
  id?: string;
  assunto: string;
  formato: 'texto' | 'html' | 'imagem';
  conteudo?: string;
  imagem_url?: string;
  remetente_email?: string;
  remetente_nome?: string;
}

interface CampaignLandingPage {
  id?: string;
  titulo: string;
  descricao?: string;
  banner_url?: string;
  video_url?: string;
  preco_original?: number;
  preco_promocional?: number;
  condicao_texto?: string;
  cta_texto?: string;
  cta_url?: string;
  cor_primaria?: string;
  ativa?: boolean;
}

interface CampaignMetrics {
  emails_enviados: number;
  emails_entregues: number;
  emails_abertos: number;
  cliques: number;
  visitas_lp: number;
  leads_gerados: number;
  matriculas_geradas: number;
  valor_gerado: number;
}

type SubView = 'list' | 'wizard' | 'analytics';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const authHeader = () => ({ 'Authorization': `Bearer ${sessionStorage.getItem('admin_token')}`, 'Content-Type': 'application/json' });

function slugify(text: string): string {
  return text
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

const STATUS_CONFIG: Record<Campaign['status'], { label: string; color: string; icon: React.ReactNode }> = {
  rascunho: { label: 'Rascunho', color: 'bg-slate-100 text-slate-600', icon: <Edit3 size={11} /> },
  ativa:    { label: 'Ativa',    color: 'bg-emerald-50 text-emerald-700', icon: <Play size={11} /> },
  pausada:  { label: 'Pausada',  color: 'bg-amber-50 text-amber-700', icon: <Pause size={11} /> },
  arquivada:{ label: 'Arquivada',color: 'bg-slate-50 text-slate-400', icon: <Archive size={11} /> },
};

// ─── Subcomponents ────────────────────────────────────────────────────────────

// Stepper
function WizardStepper({ step }: { step: number }) {
  const steps = ['Configuração', 'Público', 'E-mail', 'Landing Page', 'Revisão'];
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const num = i + 1;
        const done = step > num;
        const active = step === num;
        return (
          <React.Fragment key={num}>
            <div className="flex flex-col items-center gap-1.5 min-w-[60px]">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                done ? 'bg-indigo-600 text-white' : active ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' : 'bg-slate-100 text-slate-400'
              }`}>
                {done ? <CheckCircle2 size={16} /> : num}
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${active ? 'text-indigo-600' : 'text-slate-400'}`}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-5 transition-all ${step > num ? 'bg-indigo-600' : 'bg-slate-100'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// Metric Card
function MetricCard({ label, value, sub, icon, color }: { label: string; value: string | number; sub?: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col gap-3 shadow-sm">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
      <div>
        <p className="text-2xl font-black text-slate-900">{value}</p>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-0.5">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CampanhasTab() {
  const [subView, setSubView] = useState<SubView>('list');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [search, setSearch] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [options, setOptions] = useState<{ unidades: string[]; turmas: { id: string; nome: string; unidade: string }[] }>({ unidades: [], turmas: [] });

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/campaigns', { headers: authHeader() });
      if (res.ok) setCampaigns(await res.json());
    } catch (e) { toast.error('Erro ao carregar campanhas'); }
    finally { setLoading(false); }
  }, []);

  const fetchOptions = useCallback(async () => {
    try {
      const res = await fetch('/api/options', { headers: authHeader() });
      if (res.ok) {
        const data = await res.json();
        setOptions({ unidades: (data.unidades || []).map((u: any) => u.nome || u), turmas: data.turmas || [] });
      }
    } catch (e) { /* silent */ }
  }, []);

  useEffect(() => { fetchCampaigns(); fetchOptions(); }, [fetchCampaigns, fetchOptions]);

  const handleArchive = async (id: string) => {
    try {
      await fetch(`/api/admin/campaigns/${id}`, { method: 'PUT', headers: authHeader(), body: JSON.stringify({ status: 'arquivada' }) });
      setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: 'arquivada' } : c));
      toast.success('Campanha arquivada');
    } catch { toast.error('Erro ao arquivar'); }
  };

  const handleSend = async (id: string) => {
    if (!confirm('Disparar esta campanha agora para todos os destinatários?')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${id}/send`, { method: 'POST', headers: authHeader() });
      if (res.ok) { toast.success('Campanha disparada com sucesso!'); fetchCampaigns(); }
      else { const d = await res.json(); toast.error(d.error || 'Erro ao disparar'); }
    } catch { toast.error('Erro ao disparar campanha'); }
    finally { setLoading(false); }
  };

  const filtered = campaigns.filter(c => {
    const matchStatus = filterStatus === 'todos' || c.status === filterStatus;
    const matchSearch = !search || c.nome.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  // ─── Analytics View ──────────────────────────────────────────────────────────
  if (subView === 'analytics' && selectedCampaign) {
    const m = selectedCampaign.metrics;
    const openRate = m && m.emails_enviados > 0 ? ((m.emails_abertos / m.emails_enviados) * 100).toFixed(1) : '0';
    const ctr = m && m.emails_abertos > 0 ? ((m.cliques / m.emails_abertos) * 100).toFixed(1) : '0';
    const conv = m && m.visitas_lp > 0 ? ((m.leads_gerados / m.visitas_lp) * 100).toFixed(1) : '0';

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center gap-4">
          <button onClick={() => { setSubView('list'); setSelectedCampaign(null); }} className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 font-bold transition-colors">
            <ChevronLeft size={16} /> Voltar
          </button>
          <div className="flex-1">
            <h2 className="text-xl font-black text-slate-800">{selectedCampaign.nome}</h2>
            <p className="text-sm text-slate-500 font-medium">Dashboard de Desempenho</p>
          </div>
          {selectedCampaign.landing_page?.ativa && (
            <a href={`/campanha/${selectedCampaign.slug}`} target="_blank" rel="noreferrer"
               className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-bold text-sm hover:bg-indigo-100 transition-colors">
              <ExternalLink size={14} /> Ver Landing Page
            </a>
          )}
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Enviados" value={m?.emails_enviados ?? 0} icon={<Mail size={20} />} color="bg-indigo-50 text-indigo-600" />
          <MetricCard label="Entregues" value={m?.emails_entregues ?? 0} sub={m?.emails_enviados ? `${((( m?.emails_entregues ?? 0) / m.emails_enviados) * 100).toFixed(0)}% dos enviados` : undefined} icon={<CheckCircle2 size={20} />} color="bg-emerald-50 text-emerald-600" />
          <MetricCard label="Abertos" value={`${openRate}%`} sub={`${m?.emails_abertos ?? 0} e-mails`} icon={<Eye size={20} />} color="bg-sky-50 text-sky-600" />
          <MetricCard label="CTR" value={`${ctr}%`} sub={`${m?.cliques ?? 0} cliques`} icon={<MousePointerClick size={20} />} color="bg-violet-50 text-violet-600" />
          <MetricCard label="Visitas LP" value={m?.visitas_lp ?? 0} icon={<Globe size={20} />} color="bg-amber-50 text-amber-600" />
          <MetricCard label="Leads" value={m?.leads_gerados ?? 0} sub={m?.visitas_lp ? `${conv}% das visitas` : undefined} icon={<UserPlus size={20} />} color="bg-rose-50 text-rose-600" />
          <MetricCard label="Matrículas" value={m?.matriculas_geradas ?? 0} icon={<ShoppingCart size={20} />} color="bg-teal-50 text-teal-600" />
          <MetricCard label="ROI Estimado" value={`R$ ${(m?.valor_gerado ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={<DollarSign size={20} />} color="bg-green-50 text-green-600" />
        </div>

        {/* Conversion Funnel */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider mb-5">Funil de Conversão</h3>
          {[
            { label: 'E-mails Enviados', value: m?.emails_enviados ?? 0, color: 'bg-indigo-500' },
            { label: 'E-mails Abertos', value: m?.emails_abertos ?? 0, color: 'bg-sky-500' },
            { label: 'Cliques', value: m?.cliques ?? 0, color: 'bg-violet-500' },
            { label: 'Visitas LP', value: m?.visitas_lp ?? 0, color: 'bg-amber-500' },
            { label: 'Leads Gerados', value: m?.leads_gerados ?? 0, color: 'bg-rose-500' },
            { label: 'Matrículas', value: m?.matriculas_geradas ?? 0, color: 'bg-emerald-500' },
          ].map((item, i, arr) => {
            const max = arr[0].value || 1;
            const pct = Math.max(8, (item.value / max) * 100);
            return (
              <div key={i} className="flex items-center gap-4 mb-3">
                <span className="text-xs font-bold text-slate-500 w-32 text-right shrink-0">{item.label}</span>
                <div className="flex-1 bg-slate-50 rounded-full h-6 overflow-hidden">
                  <div className={`${item.color} h-full rounded-full flex items-center px-3 transition-all duration-700`} style={{ width: `${pct}%` }}>
                    <span className="text-white text-xs font-black">{item.value}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Send Log */}
        <SendLogTable campaignId={selectedCampaign.id} />
      </div>
    );
  }

  // ─── Wizard View ─────────────────────────────────────────────────────────────
  if (subView === 'wizard') {
    return (
      <CampaignWizard
        options={options}
        editCampaign={selectedCampaign}
        onClose={() => { setSubView('list'); setSelectedCampaign(null); }}
        onSaved={() => { fetchCampaigns(); setSubView('list'); setSelectedCampaign(null); }}
      />
    );
  }

  // ─── List View ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Campanhas</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Gerencie campanhas de e-mail e landing pages promocionais.</p>
        </div>
        <button
          onClick={() => { setSelectedCampaign(null); setSubView('wizard'); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-100 transition-all"
        >
          <Plus size={16} /> Nova Campanha
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar campanha..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['todos', 'rascunho', 'ativa', 'pausada', 'arquivada'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${filterStatus === s ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-indigo-300'}`}
            >
              {s === 'todos' ? 'Todos' : STATUS_CONFIG[s as Campaign['status']]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Campaign Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="animate-spin mr-2" size={20} /> Carregando campanhas...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
          <Megaphone size={40} className="opacity-30" />
          <div className="text-center">
            <p className="font-bold text-slate-600">Nenhuma campanha encontrada</p>
            <p className="text-sm mt-1">Crie sua primeira campanha clicando em "Nova Campanha"</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(campaign => {
            const sc = STATUS_CONFIG[campaign.status];
            const m = campaign.metrics;
            return (
              <div key={campaign.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-4 hover:shadow-md hover:border-indigo-100 transition-all group">
                {/* Card Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${sc.color}`}>
                        {sc.icon} {sc.label}
                      </span>
                      {campaign.tipo !== 'email' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-violet-50 text-violet-600">
                          <Globe size={10} /> LP
                        </span>
                      )}
                    </div>
                    <h3 className="font-black text-slate-800 truncate">{campaign.nome}</h3>
                    <p className="text-xs text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                      <span className="text-slate-300">/campanha/</span>{campaign.slug}
                    </p>
                  </div>
                </div>

                {/* Metrics Preview */}
                {m && (
                  <div className="grid grid-cols-3 gap-2 border-t border-slate-50 pt-3">
                    <div className="text-center">
                      <p className="text-sm font-black text-slate-800">{m.emails_enviados}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Enviados</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-black text-slate-800">
                        {m.emails_enviados > 0 ? `${((m.emails_abertos / m.emails_enviados) * 100).toFixed(0)}%` : '—'}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Abertura</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-black text-slate-800">{m.leads_gerados}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Leads</p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 border-t border-slate-50 pt-3">
                  <button
                    onClick={() => { setSelectedCampaign(campaign); setSubView('analytics'); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 rounded-xl text-xs font-bold transition-colors"
                  >
                    <BarChart3 size={13} /> Analytics
                  </button>
                  <button
                    onClick={() => { setSelectedCampaign(campaign); setSubView('wizard'); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-colors"
                  >
                    <Edit3 size={13} /> Editar
                  </button>
                  {campaign.status !== 'arquivada' && campaign.status !== 'ativa' && (
                    <button
                      onClick={() => handleSend(campaign.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors"
                    >
                      <Send size={13} /> Disparar
                    </button>
                  )}
                  {campaign.status !== 'arquivada' && (
                    <button
                      onClick={() => handleArchive(campaign.id)}
                      title="Arquivar"
                      className="p-2 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-colors"
                    >
                      <Archive size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Send Log Table ───────────────────────────────────────────────────────────

function SendLogTable({ campaignId }: { campaignId: string }) {
  const [sends, setSends] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/campaigns/${campaignId}/sends`, { headers: authHeader() });
        if (res.ok) setSends(await res.json());
      } finally { setLoading(false); }
    })();
  }, [campaignId]);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-50">
        <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">Log de Envios</h3>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-8 text-slate-400">
          <Loader2 className="animate-spin mr-2" size={16} /> Carregando...
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 text-left">Destinatário</th>
                <th className="px-6 py-3 text-left">E-mail</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Enviado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sends.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-sm">Nenhum envio registrado.</td></tr>
              ) : sends.map((s: any) => (
                <tr key={s.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-3 font-medium text-slate-800">{s.nome_dest || '—'}</td>
                  <td className="px-6 py-3 text-slate-500">{s.email_dest}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      s.status === 'enviado' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}>{s.status}</span>
                  </td>
                  <td className="px-6 py-3 text-slate-400 text-xs">{new Date(s.enviado_em).toLocaleString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Campaign Wizard ──────────────────────────────────────────────────────────

function CampaignWizard({
  options, editCampaign, onClose, onSaved
}: {
  options: { unidades: string[]; turmas: { id: string; nome: string; unidade: string }[] };
  editCampaign: Campaign | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [loadingAudience, setLoadingAudience] = useState(false);

  // Step 1
  const [nome, setNome] = useState(editCampaign?.nome || '');
  const [slug, setSlug] = useState(editCampaign?.slug || '');
  const [tipo, setTipo] = useState<Campaign['tipo']>(editCampaign?.tipo || 'ambos');
  const [dataInicio, setDataInicio] = useState(editCampaign?.data_inicio || '');
  const [dataFim, setDataFim] = useState(editCampaign?.data_fim || '');

  // Step 2
  const [targets, setTargets] = useState<CampaignTarget[]>(
    editCampaign?.targets || []
  );
  const [selectedUnidade, setSelectedUnidade] = useState('');
  const [selectedTurma, setSelectedTurma] = useState('');
  const [filterUnidadeTurma, setFilterUnidadeTurma] = useState('');

  // Step 3
  const [assunto, setAssunto] = useState(editCampaign?.email?.assunto || '');
  const [formato, setFormato] = useState<CampaignEmail['formato']>(editCampaign?.email?.formato || 'texto');
  const [conteudo, setConteudo] = useState(editCampaign?.email?.conteudo || '');
  const [imagemUrl, setImagemUrl] = useState(editCampaign?.email?.imagem_url || '');
  const [remetenteEmail, setRemetenteEmail] = useState(editCampaign?.email?.remetente_email || '');
  const [remetenteNome, setRemetenteNome] = useState(editCampaign?.email?.remetente_nome || '');

  // Step 4
  const [lpAtiva, setLpAtiva] = useState(editCampaign?.landing_page?.ativa || false);
  const [lpTitulo, setLpTitulo] = useState(editCampaign?.landing_page?.titulo || '');
  const [lpDescricao, setLpDescricao] = useState(editCampaign?.landing_page?.descricao || '');
  const [lpBanner, setLpBanner] = useState(editCampaign?.landing_page?.banner_url || '');
  const [lpVideo, setLpVideo] = useState(editCampaign?.landing_page?.video_url || '');
  const [lpPrecoOrig, setLpPrecoOrig] = useState(editCampaign?.landing_page?.preco_original?.toString() || '');
  const [lpPrecoPromo, setLpPrecoPromo] = useState(editCampaign?.landing_page?.preco_promocional?.toString() || '');
  const [lpCondicao, setLpCondicao] = useState(editCampaign?.landing_page?.condicao_texto || '');
  const [lpCtaTexto, setLpCtaTexto] = useState(editCampaign?.landing_page?.cta_texto || 'Quero me Matricular');
  const [lpCtaUrl, setLpCtaUrl] = useState(editCampaign?.landing_page?.cta_url || '');
  const [ctaType, setCtaType] = useState('personalizavel');
  const [whatsappCta, setWhatsappCta] = useState('');
  const [lpCor, setLpCor] = useState(editCampaign?.landing_page?.cor_primaria || '#4f46e5');

  const [lojaProdutos, setLojaProdutos] = useState<any[]>([]);
  const [eventosDisponiveis, setEventosDisponiveis] = useState<any[]>([]);

  // Step 5
  const [dispararAgora, setDispararAgora] = useState(true);
  const [agendadoPara, setAgendadoPara] = useState('');

  useEffect(() => {
    supabase.from('loja_produtos').select('id, nome, slug').then(({ data }) => {
      if (data) setLojaProdutos(data);
    });
    supabase.from('eventos').select('id, titulo, slug').then(({ data }) => {
      if (data) setEventosDisponiveis(data);
    });
  }, []);

  useEffect(() => {
    if (nome && !editCampaign) setSlug(slugify(nome));
  }, [nome, editCampaign]);

  const fetchAudienceCount = useCallback(async () => {
    if (targets.length === 0) { setAudienceCount(0); return; }
    setLoadingAudience(true);
    try {
      const res = await fetch('/api/admin/campaigns/audience-count', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ targets })
      });
      if (res.ok) { const d = await res.json(); setAudienceCount(d.count); }
    } catch { /* silent */ }
    finally { setLoadingAudience(false); }
  }, [targets]);

  useEffect(() => { if (step === 2) fetchAudienceCount(); }, [targets, step, fetchAudienceCount]);

  const addTarget = (tipo: CampaignTarget['tipo_alvo'], valor?: string) => {
    if (targets.some(t => t.tipo_alvo === tipo && t.valor_alvo === valor)) return;
    setTargets(prev => [...prev, { tipo_alvo: tipo, valor_alvo: valor }]);
  };

  const removeTarget = (i: number) => setTargets(prev => prev.filter((_, idx) => idx !== i));

  const handleSave = async (status: 'rascunho' | 'ativa') => {
    setSaving(true);
    try {
      const payload: any = {
        nome, slug, tipo, status,
        data_inicio: dataInicio || null,
        data_fim: dataFim || null,
        agendado_para: !dispararAgora && agendadoPara ? agendadoPara : null,
        targets,
        email: (tipo !== 'landing_page') ? { assunto, formato, conteudo, imagem_url: imagemUrl, remetente_email: remetenteEmail, remetente_nome: remetenteNome } : null,
        landing_page: (tipo !== 'email') ? { titulo: lpTitulo, descricao: lpDescricao, banner_url: lpBanner, video_url: lpVideo, preco_original: lpPrecoOrig ? parseFloat(lpPrecoOrig) : null, preco_promocional: lpPrecoPromo ? parseFloat(lpPrecoPromo) : null, condicao_texto: lpCondicao, cta_texto: lpCtaTexto, cta_url: lpCtaUrl, cor_primaria: lpCor, ativa: lpAtiva } : null,
      };

      const url = editCampaign ? `/api/admin/campaigns/${editCampaign.id}` : '/api/admin/campaigns';
      const method = editCampaign ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: authHeader(), body: JSON.stringify(payload) });

      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Erro ao salvar'); }
      toast.success(editCampaign ? 'Campanha atualizada!' : 'Campanha criada!');
      onSaved();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar campanha');
    } finally { setSaving(false); }
  };

  const inputClass = "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-sm font-medium";
  const labelClass = "block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-4">
        <button onClick={onClose} className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 font-bold transition-colors">
          <ChevronLeft size={16} /> Voltar
        </button>
        <h2 className="text-xl font-black text-slate-800">{editCampaign ? 'Editar Campanha' : 'Nova Campanha'}</h2>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 md:p-8">
        <WizardStepper step={step} />

        {/* ── Step 1: Config ── */}
        {step === 1 && (
          <div className="space-y-5 max-w-2xl">
            <h3 className="text-base font-black text-slate-800">Configuração Geral</h3>
            <div>
              <label className={labelClass}>Nome da Campanha</label>
              <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Matrículas Verão 2026 — Alphaville" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Slug (URL)</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400 font-medium whitespace-nowrap">/campanha/</span>
                <input value={slug} onChange={e => setSlug(slugify(e.target.value))} placeholder="matriculas-verao-2026" className={`${inputClass} flex-1`} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Tipo de Campanha</label>
              <div className="flex gap-3">
                {(['email', 'landing_page', 'ambos'] as Campaign['tipo'][]).map(t => (
                  <button key={t} onClick={() => setTipo(t)}
                    className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-bold transition-all ${tipo === t ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-indigo-300'}`}>
                    {t === 'email' ? '📧 Só E-mail' : t === 'landing_page' ? '🌐 Só Landing Page' : '🚀 Ambos'}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Data de Início</label>
                <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Data de Fim</label>
                <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className={inputClass} />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Audience ── */}
        {step === 2 && (
          <div className="space-y-5 max-w-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-800">Público-Alvo</h3>
              {loadingAudience ? (
                <span className="text-xs text-slate-400 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Calculando...</span>
              ) : audienceCount !== null ? (
                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-black">
                  ~{audienceCount} destinatário{audienceCount !== 1 ? 's' : ''}
                </span>
              ) : null}
            </div>

            {/* Unidade */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <label className={labelClass}>Por Unidade</label>
              <div className="flex gap-2">
                <select value={selectedUnidade} onChange={e => setSelectedUnidade(e.target.value)} className={`${inputClass} flex-1`}>
                  <option value="">Selecione uma unidade...</option>
                  {options.unidades.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <button onClick={() => { if (selectedUnidade) addTarget('unidade', selectedUnidade); setSelectedUnidade(''); }}
                  className="px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors shrink-0">
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* Turma */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <label className={labelClass}>Por Turma</label>
              <div className="flex flex-col gap-2">
                <select 
                  value={filterUnidadeTurma} 
                  onChange={e => { setFilterUnidadeTurma(e.target.value); setSelectedTurma(''); }} 
                  className={inputClass}
                >
                  <option value="">Selecione uma unidade para filtrar as turmas...</option>
                  {options.unidades.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                
                <div className="flex gap-2">
                  <select 
                    value={selectedTurma} 
                    onChange={e => setSelectedTurma(e.target.value)} 
                    className={`${inputClass} flex-1`}
                    disabled={!filterUnidadeTurma}
                  >
                    <option value="">{filterUnidadeTurma ? 'Selecione uma turma...' : 'Selecione a unidade acima primeiro'}</option>
                    {options.turmas.filter(t => t.unidade === filterUnidadeTurma).map(t => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </select>
                  <button onClick={() => { if (selectedTurma) addTarget('turma', selectedTurma); setSelectedTurma(''); }}
                    disabled={!selectedTurma}
                    className="px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors shrink-0 disabled:opacity-50">
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Special segments */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { tipo: 'inativos' as const, label: '🔴 Alunos Inativos', desc: 'Cancelaram o plano' },
                { tipo: 'leads' as const, label: '🟡 Leads', desc: 'Interesse sem matrícula' },
              ].map(seg => {
                const active = targets.some(t => t.tipo_alvo === seg.tipo);
                return (
                  <button key={seg.tipo} onClick={() => active ? setTargets(prev => prev.filter(t => t.tipo_alvo !== seg.tipo)) : addTarget(seg.tipo)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${active ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300'}`}>
                    <p className="font-bold text-sm text-slate-800">{seg.label}</p>
                    <p className="text-xs text-slate-500 mt-1">{seg.desc}</p>
                    {active && <span className="text-[10px] font-black text-indigo-600 uppercase">✓ Adicionado</span>}
                  </button>
                );
              })}
            </div>

            {/* Active targets */}
            {targets.length > 0 && (
              <div className="space-y-2">
                <label className={labelClass}>Segmentos Selecionados</label>
                <div className="flex flex-wrap gap-2">
                  {targets.map((t, i) => (
                    <span key={i} className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-800 rounded-xl text-xs font-bold">
                      {t.tipo_alvo === 'unidade' ? `📍 ${t.valor_alvo}` : t.tipo_alvo === 'turma' ? `🎓 Turma: ${t.valor_alvo}` : t.tipo_alvo === 'inativos' ? '🔴 Inativos' : '🟡 Leads'}
                      <button onClick={() => removeTarget(i)} className="hover:text-red-600 transition-colors"><X size={12} /></button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: E-mail ── */}
        {step === 3 && (
          <div className="space-y-5 max-w-2xl">
            <h3 className="text-base font-black text-slate-800">Conteúdo do E-mail</h3>
            <div>
              <label className={labelClass}>Assunto</label>
              <input value={assunto} onChange={e => setAssunto(e.target.value)} placeholder="Ex: 🎉 Matricule-se agora com condição especial!" className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Nome do Remetente</label>
                <input value={remetenteNome} onChange={e => setRemetenteNome(e.target.value)} placeholder="Sport For Kids" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>E-mail do Remetente</label>
                <input type="email" value={remetenteEmail} onChange={e => setRemetenteEmail(e.target.value)} placeholder="contato@sportforkids.com.br" className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Formato</label>
              <div className="flex gap-3">
                {[
                  { v: 'texto', label: 'Texto Puro', icon: <FileText size={16} /> },
                  { v: 'html', label: 'HTML', icon: <Code size={16} /> },
                  { v: 'imagem', label: 'Flyer (Imagem)', icon: <ImageIcon size={16} /> },
                ].map(f => (
                  <button key={f.v} onClick={() => setFormato(f.v as any)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-bold transition-all ${formato === f.v ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-indigo-300'}`}>
                    {f.icon} {f.label}
                  </button>
                ))}
              </div>
            </div>
            {formato === 'imagem' ? (
              <div>
                <label className={labelClass}>URL do Flyer/Imagem</label>
                <input value={imagemUrl} onChange={e => setImagemUrl(e.target.value)} placeholder="https://..." className={inputClass} />
                {imagemUrl && <img src={imagemUrl} className="mt-3 max-h-40 rounded-xl object-cover border border-slate-200" alt="preview" />}
              </div>
            ) : (
              <div>
                <label className={labelClass}>{formato === 'html' ? 'Conteúdo HTML' : 'Conteúdo do E-mail'}</label>
                <textarea
                  value={conteudo}
                  onChange={e => setConteudo(e.target.value)}
                  rows={10}
                  placeholder={formato === 'html' ? '<h1>Olá {NOME_ALUNO}!</h1>\n<p>Temos uma oferta especial para você...</p>' : 'Olá {NOME_ALUNO},\n\nTemos uma oferta especial para você...\n\nAcesse: {LINK_LP}'}
                  className={`${inputClass} resize-none font-mono text-xs`}
                />
                <p className="text-xs text-slate-400 mt-1.5 flex flex-wrap gap-1 items-center">
                  Tags disponíveis: 
                  <code className="bg-slate-100 px-1 rounded">{'{NOME_ALUNO}'}</code>
                  <code className="bg-slate-100 px-1 rounded">{'{UNIDADE}'}</code>
                  <code className="bg-slate-100 px-1 rounded">{'{TURMA}'}</code>
                  <code className="bg-slate-100 px-1 rounded">{'{RESPONSAVEL}'}</code>
                  <code className="bg-slate-100 px-1 rounded">{'{PLANO}'}</code>
                  <code className="bg-slate-100 px-1 rounded">{'{STATUS_MATRICULA}'}</code>
                  <code className="bg-slate-100 px-1 rounded">{'{LINK_LP}'}</code>
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Landing Page ── */}
        {step === 4 && (
          <div className="space-y-5 max-w-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-800">Landing Page</h3>
              <button onClick={() => setLpAtiva(!lpAtiva)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm border-2 transition-all ${lpAtiva ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}>
                <Globe size={14} /> {lpAtiva ? 'Ativa' : 'Inativa'}
              </button>
            </div>

            {tipo === 'email' && (
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700">
                <AlertCircle size={18} className="shrink-0" />
                <p className="text-sm font-medium">Esta campanha é do tipo "Só E-mail". A landing page será ignorada no disparo.</p>
              </div>
            )}

            <div>
              <label className={labelClass}>Título da Página</label>
              <input value={lpTitulo} onChange={e => setLpTitulo(e.target.value)} placeholder="Ex: Matrículas Abertas — Sport For Kids Alphaville" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Descrição</label>
              <textarea value={lpDescricao} onChange={e => setLpDescricao(e.target.value)} rows={4} placeholder="Descreva a oferta, benefícios..." className={`${inputClass} resize-none`} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>URL do Banner</label>
                <input value={lpBanner} onChange={e => setLpBanner(e.target.value)} placeholder="https://..." className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>URL do Vídeo (YouTube)</label>
                <input value={lpVideo} onChange={e => setLpVideo(e.target.value)} placeholder="https://youtube.com/embed/..." className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Preço Original (R$)</label>
                <input type="number" value={lpPrecoOrig} onChange={e => setLpPrecoOrig(e.target.value)} placeholder="299.90" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Preço Promocional (R$)</label>
                <input type="number" value={lpPrecoPromo} onChange={e => setLpPrecoPromo(e.target.value)} placeholder="199.90" className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Condição Especial</label>
              <input value={lpCondicao} onChange={e => setLpCondicao(e.target.value)} placeholder="Ex: 3 primeiras mensalidades com 30% OFF" className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Texto do Botão (CTA)</label>
                <input value={lpCtaTexto} onChange={e => setLpCtaTexto(e.target.value)} placeholder="Quero me Matricular" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Ação do Botão (CTA)</label>
                <select 
                  value={ctaType}
                  onChange={(e) => {
                    setCtaType(e.target.value);
                    if (e.target.value === 'matricula') setLpCtaUrl('/portal');
                    if (e.target.value === 'loja') setLpCtaUrl('/loja');
                    if (e.target.value === 'eventos') setLpCtaUrl('/eventos');
                    if (e.target.value === 'personalizavel') setLpCtaUrl('');
                    if (e.target.value === 'whatsapp') setLpCtaUrl(`https://wa.me/55${whatsappCta.replace(/\\D/g, '')}`);
                  }}
                  className={inputClass}
                >
                  <option value="personalizavel">Link Personalizado</option>
                  <option value="whatsapp">Link WhatsApp</option>
                  <option value="matricula">Modal de Matrícula</option>
                  <option value="loja">Produtos da Loja</option>
                  <option value="eventos">Eventos</option>
                </select>
              </div>
            </div>
            
            {(ctaType === 'personalizavel' || ctaType === 'whatsapp') && (
              <div className="col-span-2">
                <label className={labelClass}>{ctaType === 'whatsapp' ? 'Número do WhatsApp (com DDD)' : 'URL Personalizada do Botão'}</label>
                {ctaType === 'whatsapp' ? (
                  <input 
                    value={whatsappCta} 
                    onChange={e => {
                      setWhatsappCta(e.target.value);
                      setLpCtaUrl(`https://wa.me/55${e.target.value.replace(/\\D/g, '')}`);
                    }} 
                    placeholder="Ex: 11999999999" 
                    className={inputClass} 
                  />
                ) : (
                  <input 
                    value={lpCtaUrl} 
                    onChange={e => setLpCtaUrl(e.target.value)} 
                    placeholder="https://..." 
                    className={inputClass} 
                  />
                )}
              </div>
            )}
            {ctaType === 'loja' && (
              <div className="col-span-2">
                <label className={labelClass}>Selecionar Produto</label>
                <select 
                  value={lpCtaUrl.startsWith('/loja/produto') ? lpCtaUrl : '/loja'}
                  onChange={(e) => setLpCtaUrl(e.target.value)}
                  className={inputClass}
                >
                  <option value="/loja">Todos os Produtos</option>
                  {lojaProdutos.map(p => (
                    <option key={p.id} value={`/loja/produto/${p.slug}`}>Produto: {p.nome}</option>
                  ))}
                </select>
              </div>
            )}
            {ctaType === 'eventos' && (
              <div className="col-span-2">
                <label className={labelClass}>Selecionar Evento</label>
                <select 
                  value={lpCtaUrl.startsWith('/eventos/') && lpCtaUrl.length > 9 ? lpCtaUrl : '/eventos'}
                  onChange={(e) => setLpCtaUrl(e.target.value)}
                  className={inputClass}
                >
                  <option value="/eventos">Todos os Eventos</option>
                  {eventosDisponiveis.map(e => (
                    <option key={e.id} value={`/eventos/${e.slug}`}>Evento: {e.titulo}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className={labelClass}>Cor Primária</label>
              <div className="flex items-center gap-3">
                <input type="color" value={lpCor} onChange={e => setLpCor(e.target.value)} className="w-12 h-12 rounded-xl border border-slate-200 cursor-pointer" />
                <input value={lpCor} onChange={e => setLpCor(e.target.value)} className={`${inputClass} flex-1`} />
              </div>
            </div>
            {lpAtiva && slug && (
              <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                <Globe size={18} className="text-indigo-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-indigo-600 uppercase">URL pública</p>
                  <p className="text-sm font-medium text-indigo-800 truncate">/campanha/{slug}</p>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(`/campanha/${slug}`); toast.success('URL copiada!'); }}
                  className="p-2 text-indigo-500 hover:text-indigo-700 transition-colors">
                  <Copy size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Step 5: Review ── */}
        {step === 5 && (
          <div className="space-y-5 max-w-2xl">
            <h3 className="text-base font-black text-slate-800">Revisão Final</h3>
            <div className="bg-slate-50 rounded-xl p-5 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500 font-medium">Nome</span><span className="font-bold text-slate-800">{nome}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-medium">Slug</span><span className="font-bold text-slate-600">/campanha/{slug}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-medium">Tipo</span><span className="font-bold text-slate-800 capitalize">{tipo}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-medium">Público</span><span className="font-bold text-slate-800">{targets.length} segmento{targets.length !== 1 ? 's' : ''} {audienceCount !== null ? `(~${audienceCount} pessoas)` : ''}</span></div>
              {tipo !== 'landing_page' && <div className="flex justify-between"><span className="text-slate-500 font-medium">Assunto</span><span className="font-bold text-slate-800 truncate ml-4 text-right">{assunto}</span></div>}
              {tipo !== 'email' && <div className="flex justify-between"><span className="text-slate-500 font-medium">Landing Page</span><span className={`font-bold ${lpAtiva ? 'text-emerald-700' : 'text-slate-400'}`}>{lpAtiva ? '✓ Ativa' : 'Inativa'}</span></div>}
            </div>

            <div>
              <label className={labelClass}>Quando disparar?</label>
              <div className="flex gap-3">
                <button onClick={() => setDispararAgora(true)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-bold transition-all ${dispararAgora ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-indigo-300'}`}>
                  <Zap size={16} /> Agora
                </button>
                <button onClick={() => setDispararAgora(false)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-bold transition-all ${!dispararAgora ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-indigo-300'}`}>
                  <Clock size={16} /> Agendar
                </button>
              </div>
              {!dispararAgora && (
                <input type="datetime-local" value={agendadoPara} onChange={e => setAgendadoPara(e.target.value)} className={`${inputClass} mt-3`} />
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
          <button
            onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            className="flex items-center gap-2 px-5 py-2.5 text-slate-600 hover:text-slate-800 font-bold text-sm rounded-xl hover:bg-slate-50 transition-all"
          >
            <ChevronLeft size={16} /> {step > 1 ? 'Anterior' : 'Cancelar'}
          </button>

          <div className="flex gap-3">
            {step === 5 && (
              <button onClick={() => handleSave('rascunho')} disabled={saving}
                className="px-5 py-2.5 border-2 border-slate-200 text-slate-600 hover:border-slate-300 font-bold text-sm rounded-xl transition-all">
                Salvar Rascunho
              </button>
            )}
            {step < 5 ? (
              <button onClick={() => setStep(s => s + 1)}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-indigo-100">
                Próximo <ChevronRight size={16} />
              </button>
            ) : (
              <button onClick={() => handleSave('ativa')} disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-indigo-100 disabled:opacity-60">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {dispararAgora ? 'Ativar e Disparar' : 'Ativar e Agendar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
