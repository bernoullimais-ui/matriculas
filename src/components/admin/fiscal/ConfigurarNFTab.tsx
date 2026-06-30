import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Save, Settings2, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ConfigurarNFTab() {
  const [config, setConfig] = useState({
    id: '',
    frequencia: 'diario',
    dia_semana: 0,
    dia_mes: 1,
    brevo_template_id: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('configuracoes_nf')
        .select('*')
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      if (data) {
        setConfig({
          id: data.id,
          frequencia: data.frequencia,
          dia_semana: data.dia_semana || 0,
          dia_mes: data.dia_mes || 1,
          brevo_template_id: data.brevo_template_id?.toString() || ''
        });
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar configurações fiscais');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        frequencia: config.frequencia,
        updated_at: new Date().toISOString(),
        dia_semana: config.frequencia === 'semanal' ? parseInt(config.dia_semana.toString()) : null,
        dia_mes: config.frequencia === 'mensal' ? parseInt(config.dia_mes.toString()) : null,
        brevo_template_id: config.brevo_template_id ? parseInt(config.brevo_template_id) : null
      };

      let error;
      if (config.id) {
        const res = await supabase.from('configuracoes_nf').update(payload).eq('id', config.id);
        error = res.error;
      } else {
        const res = await supabase.from('configuracoes_nf').insert([payload]).select();
        error = res.error;
        if (res.data && res.data[0]) {
          setConfig(prev => ({ ...prev, id: res.data[0].id }));
        }
      }

      if (error) throw error;
      toast.success('Configurações salvas com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Carregando configurações...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Configurações Fiscais</h2>
          <p className="text-slate-500">Defina a periodicidade de emissão e envio de e-mails.</p>
        </div>
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-200"
        >
          <Save size={18} /> {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>

      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-8">
        {/* Frequência de Emissão */}
        <section>
          <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
            <Settings2 className="text-indigo-600" /> Periodicidade de Emissão
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Frequência</label>
              <select 
                value={config.frequencia}
                onChange={(e) => setConfig({ ...config, frequencia: e.target.value })}
                className="w-full md:w-96 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="imediato">Imediato (Assim que o pagamento for aprovado)</option>
                <option value="diario">Diariamente (Lote processado de madrugada)</option>
                <option value="semanal">Semanalmente (Escolha o dia da semana)</option>
                <option value="mensal">Mensalmente (Escolha o dia do mês)</option>
              </select>
            </div>

            {config.frequencia === 'semanal' && (
              <div className="pt-2 animate-in fade-in">
                <label className="block text-sm font-bold text-slate-700 mb-2">Dia da Semana</label>
                <select 
                  value={config.dia_semana}
                  onChange={(e) => setConfig({ ...config, dia_semana: parseInt(e.target.value) })}
                  className="w-full md:w-96 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={0}>Domingo</option>
                  <option value={1}>Segunda-feira</option>
                  <option value={2}>Terça-feira</option>
                  <option value={3}>Quarta-feira</option>
                  <option value={4}>Quinta-feira</option>
                  <option value={5}>Sexta-feira</option>
                  <option value={6}>Sábado</option>
                </select>
              </div>
            )}

            {config.frequencia === 'mensal' && (
              <div className="pt-2 animate-in fade-in">
                <label className="block text-sm font-bold text-slate-700 mb-2">Dia do Mês (1 a 31)</label>
                <input 
                  type="number"
                  min="1"
                  max="31"
                  value={config.dia_mes}
                  onChange={(e) => setConfig({ ...config, dia_mes: parseInt(e.target.value) })}
                  className="w-full md:w-96 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
            
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed mt-2">
              <strong>Nota:</strong> A frequência dita quando o nosso sistema agendará a emissão no Focus NFe. 
              Mesmo configurado como Diário/Semanal, se o pagamento entrar na fila, a nota ficará como "Pendente" até chegar o momento de processamento.
            </p>
          </div>
        </section>

        <hr className="border-slate-100" />

        {/* Configurações Brevo */}
        <section>
          <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
            <Mail className="text-indigo-600" /> Envio de E-mail (Brevo)
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">ID do Template na Brevo (Opcional)</label>
              <input 
                type="number"
                placeholder="Ex: 12"
                value={config.brevo_template_id}
                onChange={(e) => setConfig({ ...config, brevo_template_id: e.target.value })}
                className="w-full md:w-96 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 max-w-2xl">
              <p className="text-sm text-blue-800 leading-relaxed mb-2">
                Se você preencher um Template ID, o nosso sistema enviará o e-mail via Brevo assim que a nota for aprovada pela prefeitura.
              </p>
              <p className="text-sm text-blue-800 leading-relaxed font-bold">
                Variáveis disponíveis no Template Brevo:
              </p>
              <ul className="text-xs text-blue-700 list-disc pl-5 mt-1 space-y-1">
                <li><code>{`{{ params.NOME_CLIENTE }}`}</code></li>
                <li><code>{`{{ params.NUMERO_NOTA }}`}</code></li>
                <li><code>{`{{ params.LINK_PDF }}`}</code></li>
                <li><code>{`{{ params.LINK_XML }}`}</code></li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
