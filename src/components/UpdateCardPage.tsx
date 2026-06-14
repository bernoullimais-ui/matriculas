
import React, { useState } from 'react';
import { CreditCard, Save } from 'lucide-react';

export default function UpdateCardPage({ matriculaId }: { matriculaId: string }) {
  const [loading, setLoading] = useState(false);
  const [cardData, setCardData] = useState({ number: '', holderName: '', expDate: '', cvv: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Add API call to backend
    alert('Funcionalidade de atualização de cartão implementada no backend. Integração com Pagar.me pendente.');
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <CreditCard /> Atualizar Cartão
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Form fields here */}
            <input type="text" placeholder="Nome no Cartão" className="w-full p-2 border rounded" required />
            <input type="text" placeholder="Número do Cartão" className="w-full p-2 border rounded" required />
            <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded flex justify-center items-center gap-2">
                {loading ? 'Processando...' : <><Save size={16} /> Salvar Cartão</>}
            </button>
        </form>
      </div>
    </div>
  );
}
