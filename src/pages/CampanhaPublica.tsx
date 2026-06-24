import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, ExternalLink, CheckCircle, AlertCircle, Play } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

interface LandingPageData {
  campaign: {
    nome: string;
    slug: string;
    status: string;
  };
  landing_page: {
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
  };
}

function getEmbedUrl(url: string): string | null {
  if (!url) return null;
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  // Already an embed URL
  if (url.includes('/embed/')) return url;
  return null;
}

export default function CampanhaPublica() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<LandingPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Lead form
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [nomeResp, setNomeResp] = useState('');
  const [emailResp, setEmailResp] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [nomeAluno, setNomeAluno] = useState('');
  const [idadeAluno, setIdadeAluno] = useState('');

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const res = await fetch(`/api/public/campanha/${slug}`);
        if (res.status === 404) { setNotFound(true); return; }
        if (res.ok) {
          setData(await res.json());
          // Register visit
          fetch(`/api/public/campanha/${slug}/visit`, { method: 'POST' }).catch(() => {});
        } else { setNotFound(true); }
      } catch { setNotFound(true); }
      finally { setLoading(false); }
    })();
  }, [slug]);

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/campanha/${slug}/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome_responsavel: nomeResp, email: emailResp, whatsapp, nome_aluno: nomeAluno, idade_aluno: idadeAluno })
      });
      if (res.ok) {
        setFormSubmitted(true);
        toast.success('Recebemos seu contato! Em breve entraremos em contato.');
      } else {
        const d = await res.json();
        toast.error(d.error || 'Erro ao enviar. Tente novamente.');
      }
    } catch { toast.error('Erro de conexão. Tente novamente.'); }
    finally { setSubmitting(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <AlertCircle size={48} className="text-slate-300 mb-4" />
        <h1 className="text-2xl font-black text-slate-800 mb-2">Campanha não encontrada</h1>
        <p className="text-slate-500">Esta campanha pode ter encerrado ou o link está incorreto.</p>
        <a href="/" className="mt-6 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors">
          Ir para o site
        </a>
      </div>
    );
  }

  const lp = data.landing_page;
  const primaryColor = lp.cor_primaria || '#4f46e5';
  const embedUrl = lp.video_url ? getEmbedUrl(lp.video_url) : null;
  const hasDiscount = lp.preco_original && lp.preco_promocional && lp.preco_promocional < lp.preco_original;
  const discount = hasDiscount
    ? Math.round(((lp.preco_original! - lp.preco_promocional!) / lp.preco_original!) * 100)
    : null;

  const inputClass = "w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:border-transparent transition-all outline-none text-sm font-medium placeholder-slate-400";

  return (
    <>
      <Toaster position="top-center" />
      <div className="min-h-screen bg-slate-50 font-sans">
        {/* Hero / Banner */}
        {lp.banner_url ? (
          <div className="relative w-full h-64 sm:h-80 md:h-96 overflow-hidden">
            <img src={lp.banner_url} alt={lp.titulo} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 text-white">
              <h1 className="text-2xl md:text-4xl font-black leading-tight">{lp.titulo}</h1>
            </div>
          </div>
        ) : (
          <div className="py-14 px-6 text-center text-white" style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}cc 100%)` }}>
            <p className="text-xs font-black uppercase tracking-widest opacity-75 mb-3">Sport For Kids</p>
            <h1 className="text-3xl md:text-5xl font-black leading-tight max-w-3xl mx-auto">{lp.titulo}</h1>
          </div>
        )}

        <div className="max-w-4xl mx-auto px-4 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Left: Content */}
            <div className="lg:col-span-3 space-y-8">
              {/* Description */}
              {lp.descricao && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                  <p className="text-slate-700 leading-relaxed whitespace-pre-line">{lp.descricao}</p>
                </div>
              )}

              {/* Video */}
              {embedUrl && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                    <iframe
                      src={embedUrl}
                      className="absolute inset-0 w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title="Vídeo da campanha"
                    />
                  </div>
                </div>
              )}

              {/* Price */}
              {(lp.preco_original || lp.preco_promocional) && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex items-center gap-6">
                  {discount && (
                    <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-black text-lg shrink-0" style={{ background: primaryColor }}>
                      -{discount}%
                    </div>
                  )}
                  <div>
                    {hasDiscount && (
                      <p className="text-slate-400 text-sm line-through">
                        De R$ {lp.preco_original!.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    )}
                    <p className="text-3xl font-black" style={{ color: primaryColor }}>
                      R$ {(lp.preco_promocional || lp.preco_original)!.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      <span className="text-slate-400 text-base font-medium">/mês</span>
                    </p>
                    {lp.condicao_texto && (
                      <p className="text-sm text-slate-500 mt-1 font-medium">{lp.condicao_texto}</p>
                    )}
                  </div>
                </div>
              )}

              {/* CTA button (below content on mobile) */}
              {lp.cta_url && (
                <a
                  href={lp.cta_url}
                  target="_blank"
                  rel="noreferrer"
                  className="lg:hidden w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-black text-lg shadow-lg transition-all hover:opacity-90"
                  style={{ background: primaryColor }}
                >
                  {lp.cta_texto || 'Quero me Matricular'} <ExternalLink size={18} />
                </a>
              )}
            </div>

            {/* Right: Lead Form */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sticky top-6">
                {formSubmitted ? (
                  <div className="text-center py-6">
                    <CheckCircle size={48} className="mx-auto mb-4 text-emerald-500" />
                    <h3 className="text-xl font-black text-slate-800 mb-2">Recebemos seu contato!</h3>
                    <p className="text-slate-500 text-sm">Nossa equipe entrará em contato em breve para confirmar a matrícula.</p>
                    {lp.cta_url && (
                      <a href={lp.cta_url} target="_blank" rel="noreferrer"
                        className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-xl font-bold text-sm transition-all hover:opacity-90"
                        style={{ background: primaryColor }}>
                        {lp.cta_texto || 'Continuar'} <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="mb-5">
                      <h2 className="text-lg font-black text-slate-800">Quero me cadastrar!</h2>
                      <p className="text-sm text-slate-500 mt-1">Preencha os dados abaixo e entraremos em contato.</p>
                    </div>
                    <form onSubmit={handleLeadSubmit} className="space-y-3">
                      <input
                        required value={nomeResp} onChange={e => setNomeResp(e.target.value)}
                        placeholder="Seu nome (responsável) *"
                        className={inputClass}
                        style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                      />
                      <input
                        required type="email" value={emailResp} onChange={e => setEmailResp(e.target.value)}
                        placeholder="Seu e-mail *"
                        className={inputClass}
                      />
                      <input
                        value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
                        placeholder="WhatsApp (com DDD)"
                        className={inputClass}
                      />
                      <input
                        value={nomeAluno} onChange={e => setNomeAluno(e.target.value)}
                        placeholder="Nome do aluno"
                        className={inputClass}
                      />
                      <input
                        value={idadeAluno} onChange={e => setIdadeAluno(e.target.value)}
                        placeholder="Idade do aluno"
                        className={inputClass}
                      />
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-black transition-all hover:opacity-90 disabled:opacity-60 mt-2"
                        style={{ background: primaryColor }}
                      >
                        {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
                        Enviar dados
                      </button>
                    </form>

                    {lp.cta_url && (
                      <a
                        href={lp.cta_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-sm border-2 transition-all hover:opacity-80"
                        style={{ color: primaryColor, borderColor: primaryColor }}
                      >
                        {lp.cta_texto || 'Quero me Matricular'} <ExternalLink size={14} />
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-8 text-xs text-slate-400 font-medium border-t border-slate-100">
          © {new Date().getFullYear()} Sport For Kids · Todos os direitos reservados
        </div>
      </div>
    </>
  );
}
