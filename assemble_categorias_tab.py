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

handleSaveFrete = extract_block("const handleSaveFrete =")
handleCategoriaSubmit = extract_block("const handleCategoriaSubmit =")
handleEditCategoria = extract_block("const handleEditCategoria =")
handleDeleteCategoria = extract_block("const handleDeleteCategoria =")

# Modal JSX
modal_jsx_start = -1
for i, line in enumerate(lines):
    if "              {tab === 'categorias' && (" in line and "category-edit-form" in "".join(lines[max(0, i-20):i]):
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

content_jsx = extract_jsx("{tab === 'categorias' && (")

out = """import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';
import { motion } from 'motion/react';
import { 
  Plus, Edit2, Trash2, Tag, X, Check, Truck, Box 
} from 'lucide-react';
import { useAdminStore } from '../../../stores/adminStore';

interface Categoria {
  id: string;
  nome: string;
  slug: string;
  descricao: string;
  ordem: number;
}

export function CategoriasTab() {
  const { categorias, setCategorias, loading, setLoading } = useAdminStore();
  
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  const [categoriaForm, setCategoriaForm] = useState<Partial<Categoria>>({
    nome: '', slug: '', descricao: '', ordem: 0
  });

  const [categoriasSubTab, setCategoriasSubTab] = useState<'lista' | 'frete'>('lista');
  const [entregaCasaHabilitada, setEntregaCasaHabilitada] = useState(false);
  const [entregaCasaPreco, setEntregaCasaPreco] = useState(0);
  const [isSavingFrete, setIsSavingFrete] = useState(false);

___METHODS___

  return (
    <>
      {/* MODAL DE CATEGORIAS */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsEditing(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
              <h3 className="text-xl font-black text-slate-800">
                {selectedId ? 'Editar Categoria' : 'Nova Categoria'}
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
                form="category-edit-form"
                disabled={loadingAction}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm flex items-center gap-2"
              >
                {loadingAction ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check className="w-5 h-5" />
                )}
                {selectedId ? 'Salvar Alterações' : 'Criar Categoria'}
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
    handleSaveFrete, handleCategoriaSubmit, handleEditCategoria, handleDeleteCategoria
])

if content_jsx.startswith("{tab === 'categorias' && ("):
    content_jsx_lines = content_jsx.split("\n")
    content_jsx_lines[0] = ""
    for i in range(len(content_jsx_lines)-1, -1, -1):
        if ")}" in content_jsx_lines[i]:
            content_jsx_lines[i] = content_jsx_lines[i].replace(")}", "")
            break
    content_jsx = "\n".join(content_jsx_lines)

if modal_jsx.startswith("              {tab === 'categorias' && ("):
    modal_jsx_lines = modal_jsx.split("\n")
    modal_jsx_lines[0] = ""
    for i in range(len(modal_jsx_lines)-1, -1, -1):
        if ")}" in modal_jsx_lines[i]:
            modal_jsx_lines[i] = modal_jsx_lines[i].replace(")}", "")
            break
    modal_jsx = "\n".join(modal_jsx_lines)

out = out.replace("___METHODS___", methods)
out = out.replace("___MODAL_JSX___", modal_jsx)
out = out.replace("___CONTENT_JSX___", content_jsx)

with open('src/components/admin/ecommerce/CategoriasTab.tsx', 'w') as f:
    f.write(out)

print("Created src/components/admin/ecommerce/CategoriasTab.tsx!")
