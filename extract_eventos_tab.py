import os

with open('src/pages/Admin/UnifiedAdmin.tsx', 'r') as f:
    lines = f.readlines()

def extract_block(start_marker, braces=True):
    start_idx = -1
    for i, line in enumerate(lines):
        if start_marker in line:
            start_idx = i
            break
    if start_idx == -1: return ""
    
    if braces:
        depth = 0
        end_idx = -1
        for i in range(start_idx, len(lines)):
            depth += lines[i].count('{')
            depth -= lines[i].count('}')
            if depth == 0 and lines[i].count('}') > 0:
                end_idx = i
                break
        if end_idx != -1:
            return "".join(lines[start_idx:end_idx+1])
    return ""

def extract_jsx(start_marker):
    start_idx = -1
    for i, line in enumerate(lines):
        if start_marker in line:
            start_idx = i
            break
    if start_idx == -1: return ""
    
    depth = 0
    end_idx = -1
    for i in range(start_idx, len(lines)):
        depth += lines[i].count('(')
        depth -= lines[i].count(')')
        if depth == 0 and lines[i].count(')') > 0:
            end_idx = i
            break
    if end_idx != -1:
        return "".join(lines[start_idx:end_idx+1])
    return ""

handleEventoSubmit = extract_block("const handleEventoSubmit =")
handleDeleteEvento = extract_block("const handleDeleteEvento =")

modal_jsx_start = -1
for i, line in enumerate(lines):
    if "              {tab === 'eventos' && (" in line and "event-edit-form" in "".join(lines[max(0, i-20):i]):
        modal_jsx_start = i
        break

modal_jsx = ""
if modal_jsx_start != -1:
    depth = 0
    end_idx = -1
    for i in range(modal_jsx_start, len(lines)):
        depth += lines[i].count('(')
        depth -= lines[i].count(')')
        if depth == 0 and lines[i].count(')') > 0:
            end_idx = i
            break
    if end_idx != -1:
        modal_jsx = "".join(lines[modal_jsx_start:end_idx+1])

content_jsx = extract_jsx("{tab === 'eventos' && (")

out = """import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Edit2, Trash2, Calendar, MapPin, X, Check, Users, Map
} from 'lucide-react';
import { useAdminStore } from '../../../stores/adminStore';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';

interface Evento {
  id: string;
  titulo: string;
  slug: string;
  descricao: string;
  data_inicio: string;
  data_fim: string;
  prazo_inscricao: string;
  vagas_total?: number | null;
  taxa_inscricao: number;
  gratuito: boolean;
  status: string;
  local: string;
  unidade_nome: string;
  categorias_inscricao: string[];
  apenas_alunos: boolean;
  tipo_preco: 'gratuito' | 'fixo' | 'por_categoria';
  opcoes_precos: any[];
  campos_personalizados: any[];
  tipo: 'evento' | 'curso' | 'colonia';
}

export function EventosTab() {
  const { eventos, setEventos, options } = useAdminStore();
  
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  const [eventoForm, setEventoForm] = useState<Partial<Evento>>({
    titulo: '', slug: '', tipo: 'evento', descricao: '',
    data_inicio: '', data_fim: '', prazo_inscricao: '', local: '', unidade_nome: 'Master',
    vagas_total: null, taxa_inscricao: 0, gratuito: true, status: 'publicado',
    categorias_inscricao: [], apenas_alunos: true,
    tipo_preco: 'gratuito', opcoes_precos: [], campos_personalizados: []
  });

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newPriceOptionName, setNewPriceOptionName] = useState('');
  const [newPriceOptionPrice, setNewPriceOptionPrice] = useState<number>(0);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldTipo, setNewFieldTipo] = useState<'texto'|'numero'|'select'|'data'|'textarea'>('texto');
  const [newFieldOpcoes, setNewFieldOpcoes] = useState('');
  const [newFieldObrigatorio, setNewFieldObrigatorio] = useState(false);

___METHODS___

  return (
    <>
      {/* MODAL DE EVENTOS */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsEditing(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
              <h3 className="text-xl font-black text-slate-800">
                {selectedId ? 'Editar Evento/Curso' : 'Novo Evento/Curso'}
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(100vh-200px)]">
___MODAL_JSX___
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-slate-100 shrink-0 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="event-edit-form"
                disabled={loadingAction}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm flex items-center gap-2"
              >
                {loadingAction ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check className="w-5 h-5" />
                )}
                {selectedId ? 'Salvar Alterações' : 'Criar Evento'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MAIN CONTENT */}
___CONTENT_JSX___
    </>
  );
}
"""

methods = "\n".join([
    handleEventoSubmit, handleDeleteEvento
])

if content_jsx.startswith("{tab === 'eventos' && ("):
    content_lines = content_jsx.split("\n")
    content_lines[0] = ""
    for i in range(len(content_lines)-1, -1, -1):
        if ")}" in content_lines[i]:
            content_lines[i] = content_lines[i].replace(")}", "")
            break
    content_jsx = "\n".join(content_lines)

if modal_jsx.startswith("              {tab === 'eventos' && ("):
    modal_lines = modal_jsx.split("\n")
    modal_lines[0] = ""
    for i in range(len(modal_lines)-1, -1, -1):
        if ")}" in modal_lines[i]:
            modal_lines[i] = modal_lines[i].replace(")}", "")
            break
    modal_jsx = "\n".join(modal_lines)

out = out.replace("___METHODS___", methods)
out = out.replace("___MODAL_JSX___", modal_jsx)
out = out.replace("___CONTENT_JSX___", content_jsx)

with open('src/components/admin/courses/EventosTab.tsx', 'w') as f:
    f.write(out)

print("Created src/components/admin/courses/EventosTab.tsx!")
