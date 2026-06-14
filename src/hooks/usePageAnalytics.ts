import { useEffect, useRef } from 'react';

function getOrCreateSessionId(): string {
  const KEY = 'sfk_sid';
  let sid = localStorage.getItem(KEY);
  if (!sid) {
    sid = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(KEY, sid);
  }
  return sid;
}

function detectDevice(): string {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|mini|windows\sce|palm/i.test(ua)) return 'mobile';
  return 'desktop';
}

function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg')) return 'Edge';
  return 'Outro';
}

function getUtmSource(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('utm_source');
}

export function usePageAnalytics(pagina: string, titulo: string) {
  const startTimeRef = useRef<number>(Date.now());
  const sentRef = useRef<boolean>(false);

  const sendEvent = (tempoSegundos: number) => {
    if (sentRef.current) return;
    sentRef.current = true;

    const payload = {
      session_id: getOrCreateSessionId(),
      pagina,
      titulo,
      dispositivo: detectDevice(),
      navegador: detectBrowser(),
      referrer: document.referrer || null,
      utm_source: getUtmSource(),
      tempo_segundos: tempoSegundos,
    };

    // Use sendBeacon para garantir envio mesmo ao fechar a aba
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    navigator.sendBeacon('/api/analytics/pageview', blob);
  };

  useEffect(() => {
    startTimeRef.current = Date.now();
    sentRef.current = false;

    const handleUnload = () => {
      const tempo = Math.round((Date.now() - startTimeRef.current) / 1000);
      sendEvent(tempo);
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      // Também envia ao desmontar o componente (navegação SPA)
      const tempo = Math.round((Date.now() - startTimeRef.current) / 1000);
      sendEvent(tempo);
    };
  }, [pagina]);
}
