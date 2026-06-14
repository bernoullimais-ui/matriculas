import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar, MapPin, ChevronRight, Trophy, Users, Star, Clock, Filter, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { usePageAnalytics } from '../../hooks/usePageAnalytics';

interface Evento {
  id: string;
  titulo: string;
  slug: string;
  tipo: string;
  descricao?: string;
  data_inicio: string;
  data_fim?: string;
  local?: string;
  unidade_nome?: string;
  imagem_capa?: string;
  vagas_total?: number;
  vagas_disponiveis?: number;
  taxa_inscricao: number;
  gratuito: boolean;
  status: string;
  categorias_inscricao: { nome: string; vagas: number; inscritos: number }[];
  tipo_preco?: 'gratuito' | 'fixo' | 'categorias';
  opcoes_precos?: { nome: string; preco: number }[];
}

const tipoLabel: Record<string, { label: string; cor: string; icon: string }> = {
  competicao: { label: 'Competição', cor: 'bg-red-100 text-red-700', icon: '🏆' },
  apresentacao: { label: 'Apresentação', cor: 'bg-purple-100 text-purple-700', icon: '🎭' },
  aula_publica: { label: 'Aula Pública', cor: 'bg-emerald-100 text-emerald-700', icon: '🎓' },
  workshop: { label: 'Workshop', cor: 'bg-amber-100 text-amber-700', icon: '⚡' },
  evento: { label: 'Evento', cor: 'bg-blue-100 text-blue-700', icon: '📅' },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return {
    dia: d.getDate().toString().padStart(2, '0'),
    mes: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase(),
    hora: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    full: d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function EventoCard({ evento }: { evento: Evento }) {
  const { dia, mes, hora } = formatDate(evento.data_inicio);
  const tipo = tipoLabel[evento.tipo] || tipoLabel.evento;
  const vagasDisponiveis = evento.vagas_disponiveis ?? evento.vagas_total;
  const esgotado = vagasDisponiveis != null && vagasDisponiveis <= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 group flex flex-col"
    >
      {/* Image */}
      <Link to={`/eventos/${evento.slug}`} className="block relative overflow-hidden">
        <div className="aspect-[4/5] bg-gradient-to-br from-indigo-100 to-violet-100 relative">
          {evento.imagem_capa ? (
            <img src={evento.imagem_capa} alt={evento.titulo} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-5xl">
              {tipo.icon}
            </div>
          )}
          {esgotado && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="bg-red-500 text-white font-bold px-4 py-2 rounded-full">Esgotado</span>
            </div>
          )}
        </div>

        {/* Date badge */}
        <div className="absolute top-3 left-3 bg-white rounded-xl shadow-lg p-2 text-center min-w-[52px]">
          <p className="text-xs font-bold text-indigo-600 leading-none">{mes}</p>
          <p className="text-2xl font-black text-slate-900 leading-none mt-0.5">{dia}</p>
        </div>
      </Link>

      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tipo.cor}`}>
            {tipo.icon} {tipo.label}
          </span>
          {evento.tipo_preco === 'gratuito' || evento.gratuito ? (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Gratuito</span>
          ) : evento.tipo_preco === 'categorias' && evento.opcoes_precos && evento.opcoes_precos.length > 0 ? (
            (() => {
              const precos = evento.opcoes_precos.map(o => Number(o.preco || 0));
              const min = Math.min(...precos);
              const max = Math.max(...precos);
              return (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {min === max ? formatCurrency(min) : `${formatCurrency(min)} a ${formatCurrency(max)}`}
                </span>
              );
            })()
          ) : (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {formatCurrency(evento.taxa_inscricao)}
            </span>
          )}
        </div>

        <Link to={`/eventos/${evento.slug}`}>
          <h3 className="font-bold text-slate-800 text-base leading-tight mb-2 hover:text-indigo-600 transition-colors line-clamp-2">
            {evento.titulo}
          </h3>
        </Link>

        <div className="space-y-1.5 mt-auto">
          <div className="flex items-center gap-1.5 text-sm text-slate-500">
            <Clock size={14} className="text-slate-400" />
            <span>{hora}h</span>
          </div>
          {(evento.local || evento.unidade_nome) && (
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              <MapPin size={14} className="text-slate-400" />
              <span className="line-clamp-1">{evento.local || evento.unidade_nome}</span>
            </div>
          )}
          {evento.vagas_total && (
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              <Users size={14} className="text-slate-400" />
              <span>
                {esgotado ? 'Sem vagas' : `${vagasDisponiveis} vaga${vagasDisponiveis !== 1 ? 's' : ''} disponível`}
              </span>
            </div>
          )}
        </div>

        <Link
          to={`/eventos/${evento.slug}`}
          className={`mt-4 w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
            esgotado
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-100'
          }`}
        >
          {esgotado ? 'Esgotado' : 'Ver Detalhes'}
          {!esgotado && <ArrowRight size={15} />}
        </Link>
      </div>
    </motion.div>
  );
}

export default function EventosPage() {
  usePageAnalytics('/eventos', 'Central de Eventos');

  useEffect(() => {
    document.title = "Central de Eventos — Sport for Kids";
  }, []);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const tipoAtivo = searchParams.get('tipo') || '';

  const fetchEventos = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/eventos${tipoAtivo ? `?tipo=${tipoAtivo}` : ''}`;
      const res = await fetch(url).then(r => r.json());
      setEventos(res.eventos || []);
    } catch (err) {
      console.error('Erro ao carregar eventos:', err);
    } finally {
      setLoading(false);
    }
  }, [tipoAtivo]);

  useEffect(() => { fetchEventos(); }, [fetchEventos]);

  const tipos = ['competicao', 'apresentacao', 'aula_publica', 'workshop'];
  const proximosEventos = eventos.filter(e => new Date(e.data_inicio) > new Date());
  const eventosPassados = eventos.filter(e => new Date(e.data_inicio) <= new Date());

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="flex items-center gap-2 text-purple-200 text-sm mb-3">
            <Link to={localStorage.getItem('last_unit_slug') ? `/portal/${localStorage.getItem('last_unit_slug')}` : '/'} className="hover:text-white transition-colors">Início</Link>
            <ChevronRight size={14} />
            <span>Eventos</span>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-2xl">🏆</div>
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold">Central de Eventos</h1>
              <p className="text-purple-200 text-lg">Competições, apresentações e aulas abertas</p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-6 mt-6">
            <div className="text-center">
              <p className="text-2xl font-black">{proximosEventos.length}</p>
              <p className="text-purple-200 text-xs uppercase tracking-wider">Próximos</p>
            </div>
            <div className="w-px bg-white/20" />
            <div className="text-center">
              <p className="text-2xl font-black">{eventos.filter(e => e.gratuito).length}</p>
              <p className="text-purple-200 text-xs uppercase tracking-wider">Gratuitos</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Filter by tipo */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-8 scrollbar-hide">
          <button
            onClick={() => { const p = new URLSearchParams(); setSearchParams(p); }}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${!tipoAtivo ? 'bg-violet-600 text-white shadow-lg shadow-violet-200' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
          >
            Todos
          </button>
          {tipos.map(tipo => {
            const t = tipoLabel[tipo];
            return (
              <button
                key={tipo}
                onClick={() => setSearchParams({ tipo })}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5 ${tipoAtivo === tipo ? 'bg-violet-600 text-white shadow-lg shadow-violet-200' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
              >
                {t.icon} {t.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse">
                <div className="aspect-[4/5] bg-slate-100" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-slate-100 rounded w-1/3" />
                  <div className="h-5 bg-slate-100 rounded w-3/4" />
                  <div className="h-4 bg-slate-100 rounded w-1/2" />
                  <div className="h-10 bg-slate-100 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : eventos.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📅</div>
            <h3 className="text-xl font-bold text-slate-700 mb-2">Nenhum evento disponível</h3>
            <p className="text-slate-400">Em breve novos eventos serão publicados</p>
          </div>
        ) : (
          <>
            {proximosEventos.length > 0 && (
              <div className="mb-10">
                <h2 className="text-xl font-bold text-slate-800 mb-5 flex items-center gap-2">
                  <Calendar size={20} className="text-violet-600" />
                  Próximos Eventos
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {proximosEventos.map(e => <EventoCard key={e.id} evento={e} />)}
                </div>
              </div>
            )}

            {eventosPassados.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-slate-500 mb-5 flex items-center gap-2">
                  <Clock size={20} />
                  Eventos Encerrados
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-60">
                  {eventosPassados.map(e => <EventoCard key={e.id} evento={e} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
