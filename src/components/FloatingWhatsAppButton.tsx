import React from 'react';
import { useFranquiaTheme } from '../hooks/useFranquiaTheme';

export default function FloatingWhatsAppButton() {
  const { theme } = useFranquiaTheme();

  // Oculta nas rotas de administração
  if (window.location.pathname.startsWith('/gestao')) {
    return null;
  }

  const rawPhone = theme?.whatsapp || '557130457777';
  const cleanPhone = rawPhone.replace(/\D/g, '');
  
  const message = encodeURIComponent('Olá, gostaria de ajuda com as matrículas!');
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${message}`;

  const isLojaPage = window.location.pathname.startsWith('/loja') && window.location.pathname !== '/loja/checkout';

  return (
    <div className={`fixed ${isLojaPage ? 'bottom-24' : 'bottom-6'} right-6 z-50 flex items-center font-sans`}>
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2.5 bg-[#25D366] hover:bg-[#20ba5a] text-white px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 hover:scale-105 active:scale-95 border border-white/20 select-none group"
        style={{ textDecoration: 'none' }}
      >
        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#25D366] shadow-sm transition-transform duration-300 group-hover:rotate-12">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.419 5.422.001 12.083.001c3.229.001 6.262 1.258 8.543 3.541 2.28 2.283 3.535 5.318 3.535 8.545 0 6.661-5.421 12.078-12.083 12.078-2.003 0-3.972-.5-5.713-1.448L0 24zm6.59-4.846c1.6.95 3.498 1.452 5.43 1.453 5.432 0 9.85-4.417 9.852-9.849.002-2.63-1.023-5.101-2.882-6.959-1.859-1.859-4.329-2.884-6.96-2.884-5.431 0-9.85 4.417-9.852 9.849-.001 1.99.513 3.93 1.49 5.642l-.974 3.553 3.64-.954zm10.934-5.45c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.569-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          </svg>
        </div>
        <span className="font-black text-sm tracking-wide pr-1">
          Posso Ajudar?
        </span>
      </a>
    </div>
  );
}
