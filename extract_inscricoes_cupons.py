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

# ----- InscricoesTab -----
handleCheckin = extract_block("const handleCheckin =")
handleUpdateInscricao = extract_block("const handleUpdateInscricao =")
handleDeleteInscricao = extract_block("const handleDeleteInscricao =")
handleEditInscricao = extract_block("const handleEditInscricao =")

content_inscricoes = extract_jsx("{tab === 'inscricoes' && (")
# wait, inscricoes has no modal, but wait: showInscricaoDetails and showInscricaoEdit
modal_inscricoes_details = extract_jsx("{showInscricaoDetails && (")
modal_inscricoes_edit = extract_jsx("{showInscricaoEdit && (")

if content_inscricoes.startswith("{tab === 'inscricoes' && ("):
    cl = content_inscricoes.split("\n")
    cl[0] = ""
    for i in range(len(cl)-1, -1, -1):
        if ")}" in cl[i]:
            cl[i] = cl[i].replace(")}", "")
            break
    content_inscricoes = "\n".join(cl)

out_inscricoes = f"""import React, {{ useState }} from 'react';
import {{ supabase }} from '../../../lib/supabase';
import toast from 'react-hot-toast';
import {{ motion }} from 'motion/react';
import {{ 
  Search, X, Check, Eye, Trash2, Edit2, Ticket, CheckCircle2, Circle, AlertCircle, RefreshCw, Send, Save
}} from 'lucide-react';
import {{ useAdminStore }} from '../../../stores/adminStore';
import {{ formatCurrency, formatDateTime }} from '../../../utils/formatters';

export function InscricoesTab() {{
  const {{ inscricoes, setInscricoes, eventos }} = useAdminStore();
  
  const [showInscricaoDetails, setShowInscricaoDetails] = useState<any | null>(null);
  const [showInscricaoEdit, setShowInscricaoEdit] = useState<any | null>(null);
  const [enrollmentSearch, setEnrollmentSearch] = useState('');
  const [filtroEventoId, setFiltroEventoId] = useState<string>('');
  
{handleCheckin}
{handleUpdateInscricao}
{handleDeleteInscricao}
{handleEditInscricao}

  return (
    <>
      {{/* MODAL DE DETALHES */}}
      {modal_inscricoes_details}

      {{/* MODAL DE EDIÇÃO */}}
      {modal_inscricoes_edit}

      {{/* MAIN CONTENT */}}
      {content_inscricoes}
    </>
  );
}}
"""

with open('src/components/admin/courses/InscricoesTab.tsx', 'w') as f:
    f.write(out_inscricoes)

print("Created InscricoesTab.tsx")

# ----- CuponsTab -----
handleCouponSubmit = extract_block("const handleCouponSubmit =")
handleCouponEditSave = extract_block("const handleCouponEditSave =")

content_cupons = extract_jsx("{tab === 'cupons' && (")

if content_cupons.startswith("{tab === 'cupons' && ("):
    cl = content_cupons.split("\n")
    cl[0] = ""
    for i in range(len(cl)-1, -1, -1):
        if ")}" in cl[i]:
            cl[i] = cl[i].replace(")}", "")
            break
    content_cupons = "\n".join(cl)

out_cupons = f"""import React, {{ useState }} from 'react';
import {{ supabase }} from '../../../lib/supabase';
import toast from 'react-hot-toast';
import {{ 
  Plus, Edit2, Trash2, Save, Tag, Ticket
}} from 'lucide-react';
import {{ useAdminStore }} from '../../../stores/adminStore';
import {{ formatCurrency }} from '../../../utils/formatters';

export function CuponsTab() {{
  const {{ cupons, setCupons, cuponsDeMatriculas, setCuponsDeMatriculas, eventos, produtos }} = useAdminStore();
  
  const [cuponsSubTab, setCuponsSubTab] = useState<'cursos'|'produtos'|'eventos'>('cursos');
  const [editingCupomId, setEditingCupomId] = useState<string | null>(null);
  const [cupomEditForm, setCupomEditForm] = useState<Record<string, any>>({{}});
  const [loadingAction, setLoadingAction] = useState(false);

  const getTodayDateString = () => new Date().toISOString().split('T')[0];

  const [cupomForm, setCupomForm] = useState({{
    codigo: '', tipo_desconto: 'porcentagem', valor: 0,
    data_validade: '', uso_maximo: null, ativo: true,
    aplicabilidade: 'todos', produto_id: ''
  }});

  const [cupomCursoForm, setCupomCursoForm] = useState({{
    codigo: '', tipo: 'porcentagem', valor: 0, data_inicio: getTodayDateString(),
    data_validade: '', evento_id: '', curso_id: ''
  }});

{handleCouponSubmit}
{handleCouponEditSave}

  const handleDeleteCupom = async (id: string, table: string = 'loja_cupons') => {{
    if (!window.confirm('Excluir cupom?')) return;
    try {{
      const res = await fetch(`/api/admin/loja/cupons/${{id}}?table=${{table}}`, {{
        method: 'DELETE',
        headers: {{ 'Authorization': `Bearer ${{sessionStorage.getItem('admin_token')}}` }}
      }});
      if (!res.ok) throw new Error('Erro ao excluir');
      toast.success('Cupom excluído!');
      if (table === 'loja_cupons') {{
        setCupons(prev => prev.filter(c => c.id !== id));
      }} else {{
        setCuponsDeMatriculas(prev => prev.filter(c => c.id !== id));
      }}
    }} catch (err) {{
      toast.error('Erro ao excluir cupom');
    }}
  }};

  return (
    <>
      {content_cupons}
    </>
  );
}}
"""

with open('src/components/admin/courses/CuponsTab.tsx', 'w') as f:
    f.write(out_cupons)

print("Created CuponsTab.tsx")

