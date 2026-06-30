import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Save, Plus, Trash2, Shield, User } from 'lucide-react';

interface Autorizacao {
  id?: string;
  tipo_alvo: 'nivel' | 'usuario';
  alvo_id: string;
  sistema: 'gestao_sfk' | 'painel_admin';
  modulo: string;
  pode_visualizar: boolean;
  pode_editar: boolean;
  pode_excluir: boolean;
}

const MODULOS_PAINEL = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'gestao_alunos_matriculas', label: 'Gestão de Alunos - Matrículas' },
  { id: 'gestao_alunos_aprovacoes', label: 'Gestão de Alunos - Aprovações' },
  { id: 'gestao_alunos_fila_espera', label: 'Gestão de Alunos - Fila de Espera' },
  { id: 'gestao_alunos_fale_conosco', label: 'Gestão de Alunos - Fale Conosco' },
  { id: 'loja_pedidos', label: 'Loja - Pedidos' },
  { id: 'loja_produtos', label: 'Loja - Produtos' },
  { id: 'loja_categorias', label: 'Loja - Categorias' },
  { id: 'cursos_eventos_eventos', label: 'Cursos / Eventos - Eventos' },
  { id: 'cursos_eventos_inscricoes', label: 'Cursos / Eventos - Inscrições' },
  { id: 'comercial_campanhas', label: 'Comercial - Campanhas' },
  { id: 'comercial_cupons', label: 'Comercial - Cupons' },
  { id: 'escolas_parceiras_regras_repasse', label: 'Escolas Parceiras - Regras de Repasse' },
  { id: 'escolas_parceiras_conciliacao', label: 'Escolas Parceiras - Conciliação' },
  { id: 'recursos_humanos_contratos_equipe', label: 'Recursos Humanos - Contratos & Equipe' },
  { id: 'recursos_humanos_folha_pagamento', label: 'Recursos Humanos - Folha de Pagamento' },
  { id: 'fiscal_notas', label: 'Fiscal - Notas Fiscais' },
  { id: 'fiscal_configuracoes', label: 'Fiscal - Configurações' },
  { id: 'configuracoes', label: 'Configurações' }
];

const MODULOS_GESTAO = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'alunos', label: 'Alunos' },
  { id: 'turmas', label: 'Turmas' },
  { id: 'preparacao', label: 'Preparação' },
  { id: 'avaliacao', label: 'Avaliação' },
  { id: 'frequencia', label: 'Frequência' },
  { id: 'experimentais', label: 'Experimentais' },
  { id: 'ocorrencias', label: 'Ocorrências' },
  { id: 'bi_business', label: 'BI & Business' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'retencao', label: 'Retenção' },
  { id: 'equipe', label: 'Equipe' },
  { id: 'aprovacoes_pix', label: 'Aprovações Pix' },
  { id: 'configuracoes', label: 'Configurações' },
  { id: 'atendimento_ia', label: 'Atendimento IA' }
];

export default function AuthorizationsTab() {
  const [autorizacoes, setAutorizacoes] = useState<Autorizacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'nivel' | 'usuario'>('nivel');
  
  const niveis = ['Gestor Master', 'Gestor Administrativo', 'Gestor Operacional', 'Gestor de Unidade', 'Regente', 'Franqueado', 'Professor', 'Staff'];
  const [usuariosDb, setUsuariosDb] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('admin_token');
      const res = await fetch('/api/admin/autorizacoes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAutorizacoes(data.autorizacoes || []);
        setUsuariosDb(data.usuarios || []);
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao buscar autorizações.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (alvo_id: string, sistema: 'gestao_sfk' | 'painel_admin', modulo: string, field: 'pode_visualizar' | 'pode_editar' | 'pode_excluir') => {
    setAutorizacoes(prev => {
      const idx = prev.findIndex(a => a.alvo_id === alvo_id && a.sistema === sistema && a.modulo === modulo);
      if (idx >= 0) {
        const novo = [...prev];
        novo[idx] = { ...novo[idx], [field]: !novo[idx][field] };
        return novo;
      } else {
        return [...prev, {
          tipo_alvo: activeTab,
          alvo_id,
          sistema,
          modulo,
          pode_visualizar: field === 'pode_visualizar',
          pode_editar: field === 'pode_editar',
          pode_excluir: field === 'pode_excluir'
        }];
      }
    });
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      const token = sessionStorage.getItem('admin_token');
      const res = await fetch('/api/admin/autorizacoes', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ autorizacoes })
      });
      if (res.ok) {
        toast.success('Autorizações salvas com sucesso!');
        fetchData();
      } else {
        throw new Error('Erro na resposta');
      }
    } catch (e) {
      toast.error('Erro ao salvar autorizações.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Carregando permissões...</div>;
  }

  const renderMatrix = (alvo_id: string, sistema: 'gestao_sfk' | 'painel_admin', modulos: {id: string, label: string}[]) => {
    return (
      <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 font-bold text-slate-700 text-sm uppercase">
          {sistema === 'painel_admin' ? 'Painel Administrativo' : 'Gestão SFK'}
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-semibold">Módulo</th>
              <th className="px-4 py-2 font-semibold text-center w-24">Visualizar</th>
              <th className="px-4 py-2 font-semibold text-center w-24">Editar</th>
              <th className="px-4 py-2 font-semibold text-center w-24">Excluir</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {modulos.map(mod => {
              const rule = autorizacoes.find(a => a.alvo_id === alvo_id && a.sistema === sistema && a.modulo === mod.id) || { pode_visualizar: false, pode_editar: false, pode_excluir: false };
              return (
                <tr key={mod.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-700">{mod.label}</td>
                  <td className="px-4 py-2 text-center">
                    <input type="checkbox" checked={rule.pode_visualizar} onChange={() => handleToggle(alvo_id, sistema, mod.id, 'pode_visualizar')} className="w-4 h-4 text-indigo-600 rounded" />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input type="checkbox" checked={rule.pode_editar} onChange={() => handleToggle(alvo_id, sistema, mod.id, 'pode_editar')} className="w-4 h-4 text-indigo-600 rounded" />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input type="checkbox" checked={rule.pode_excluir} onChange={() => handleToggle(alvo_id, sistema, mod.id, 'pode_excluir')} className="w-4 h-4 text-indigo-600 rounded" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const usuariosExcecao = usuariosDb.filter(u => autorizacoes.some(a => a.tipo_alvo === 'usuario' && a.alvo_id === u.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Controle de Acesso (RBAC)</h2>
          <p className="text-sm text-slate-500">Gerencie as permissões de exibição, edição e exclusão por módulo.</p>
        </div>
        <button onClick={saveChanges} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-sm">
          <Save size={16} /> {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>

      <div className="flex border-b border-slate-200">
        <button onClick={() => setActiveTab('nivel')} className={`flex items-center gap-2 px-6 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'nivel' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <Shield size={16} /> Por Nível (Cargo)
        </button>
        <button onClick={() => setActiveTab('usuario')} className={`flex items-center gap-2 px-6 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'usuario' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <User size={16} /> Exceções (Por Usuário)
        </button>
      </div>

      {activeTab === 'nivel' && (
        <div className="space-y-8">
          {niveis.map(nivel => (
            <div key={nivel} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                <Shield size={20} className="text-indigo-500" /> {nivel}
              </h3>
              <p className="text-sm text-slate-500 mb-4">Permissões aplicadas a todos os usuários deste nível.</p>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {renderMatrix(nivel, 'painel_admin', MODULOS_PAINEL)}
                {renderMatrix(nivel, 'gestao_sfk', MODULOS_GESTAO)}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'usuario' && (
        <div className="space-y-8">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-sm text-amber-800">
            <strong>Atenção:</strong> As regras cadastradas para um usuário específico sobrescrevem completamente as regras do Nível (Cargo) dele.
          </div>
          
          {usuariosExcecao.map(user => (
            <div key={user.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative">
              <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                <User size={20} className="text-indigo-500" /> {user.nome}
              </h3>
              <p className="text-sm text-slate-500 mb-4">Nível original: {user.nivel}</p>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {renderMatrix(user.id, 'painel_admin', MODULOS_PAINEL)}
                {renderMatrix(user.id, 'gestao_sfk', MODULOS_GESTAO)}
              </div>
            </div>
          ))}

          {usuariosExcecao.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 border-dashed">
              <p className="text-slate-500">Nenhuma exceção por usuário cadastrada no momento.</p>
            </div>
          )}
          
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h4 className="font-bold text-slate-800 mb-2">Adicionar Nova Exceção</h4>
            <div className="flex gap-4">
              <select id="newUserSelect" className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm outline-none">
                <option value="">Selecione um usuário...</option>
                {usuariosDb.filter(u => !usuariosExcecao.some(e => e.id === u.id)).map(u => (
                  <option key={u.id} value={u.id}>{u.nome} ({u.nivel})</option>
                ))}
              </select>
              <button 
                onClick={() => {
                  const sel = document.getElementById('newUserSelect') as HTMLSelectElement;
                  if (sel.value) {
                    handleToggle(sel.value, 'painel_admin', 'dashboard', 'pode_visualizar');
                    sel.value = '';
                  }
                }}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold flex items-center gap-2"
              >
                <Plus size={16} /> Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
