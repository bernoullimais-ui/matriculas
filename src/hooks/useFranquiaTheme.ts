import { useState, useEffect } from 'react';

interface FranquiaTheme {
  nome: string;
  cor_primaria: string | null;
  logo_url: string | null;
  whatsapp: string | null;
}

// Helper to darken/lighten hex color
function adjustColor(color: string, amount: number) {
  let hex = color.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  return '#' + hex.replace(/../g, c => ('0'+Math.min(255, Math.max(0, parseInt(c, 16) + amount)).toString(16)).substr(-2));
}

export function useFranquiaTheme() {
  const [theme, setTheme] = useState<FranquiaTheme | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTheme = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const franquia = urlParams.get('franquia');

      if (!franquia) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/franquia/${encodeURIComponent(franquia)}`);
        if (response.ok) {
          const data = await response.json();
          setTheme({
            nome: data.nome,
            cor_primaria: data.cor_primaria,
            logo_url: data.logo_url,
            whatsapp: data.whatsapp
          });

          // Apply dynamic color if available
          if (data.cor_primaria) {
            const primary = data.cor_primaria;
            document.documentElement.style.setProperty('--theme-primary', primary);
            document.documentElement.style.setProperty('--theme-primary-dark', adjustColor(primary, -20));
            document.documentElement.style.setProperty('--theme-primary-light', adjustColor(primary, 20));
            document.documentElement.style.setProperty('--theme-primary-50', primary + '1A'); // 10% opacity
            document.documentElement.style.setProperty('--theme-primary-100', primary + '33'); // 20% opacity
          }
        }
      } catch (error) {
        console.error('Erro ao buscar tema da franquia:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTheme();
  }, []);

  return { theme, loading };
}

