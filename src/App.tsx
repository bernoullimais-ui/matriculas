import React, { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import EnrollmentModal from './components/EnrollmentModal';
import { useFranquiaTheme } from './hooks/useFranquiaTheme';

export default function App() {
  const { theme, loading: themeLoading } = useFranquiaTheme();
  const [isEnrollmentOpen, setIsEnrollmentOpen] = useState(false);
  const [preferredUnit, setPreferredUnit] = useState<string>('');

  useEffect(() => {
    // Allow opening enrollment modal via URL parameters (used by other pages that redirect to root)
    const urlParams = new URLSearchParams(window.location.search);
    const from = urlParams.get('from');
    const paramUnidade = urlParams.get('unidade');
    
    if (from === 'portal' || urlParams.has('enroll')) {
      if (paramUnidade) {
        setPreferredUnit(paramUnidade);
      }
      setIsEnrollmentOpen(true);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleLandingLoginSuccess = (data: any, registeredUnit?: string) => {
    localStorage.setItem('guardian', JSON.stringify(data.guardian || data));
    const alunos = data.alunos || [];
    let firstUnit = '';
    if (alunos && Array.isArray(alunos)) {
      for (const aluno of alunos) {
        if (aluno.unidade) {
          firstUnit = aluno.unidade;
          break;
        }
      }
    }
    
    if (registeredUnit) {
      const slug = registeredUnit.toLowerCase().replace(/\s+/g, '-');
      window.location.href = `/portal/${slug}`;
    } else if (firstUnit) {
      const slug = firstUnit.toLowerCase().replace(/\s+/g, '-');
      window.location.href = `/portal/${slug}`;
    } else {
      window.location.href = '/portal';
    }
  };

  if (themeLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <>
      <LandingPage 
        onStartEnrollment={(unidadePref) => {
          if (unidadePref) setPreferredUnit(unidadePref);
          setIsEnrollmentOpen(true);
        }}
        onLoginSuccess={handleLandingLoginSuccess}
        logoUrl={theme?.logo_url}
        brandName={theme?.nome}
      />
      
      {isEnrollmentOpen && (
        <EnrollmentModal 
          isOpen={isEnrollmentOpen}
          onClose={() => setIsEnrollmentOpen(false)}
          preSelectedUnidade={preferredUnit}
        />
      )}
    </>
  );
}
