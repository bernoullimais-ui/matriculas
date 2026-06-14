import re

with open('src/components/admin/courses/InscricoesTab.tsx', 'r') as f:
    content = f.read()

# 1. Imports
content = content.replace("import { \n  Search, X, Check, Eye, Trash2, Edit2, Ticket, CheckCircle2, Circle, AlertCircle, RefreshCw, Send, Save\n, MessageCircle, Info} from 'lucide-react';", "import { \n  Search, X, Check, Eye, Trash2, Edit2, Ticket, CheckCircle2, Circle, AlertCircle, RefreshCw, Send, Save\n, MessageCircle, Info} from 'lucide-react';")

if "MessageCircle" not in content:
    content = content.replace("Send, Save", "Send, Save, MessageCircle, Info")

# 2. Add showBulkWhatsAppModal and filteredInscricoes
target = "const [filtroEventoId, setFiltroEventoId] = useState<string>('');"
replacement = """const [filtroEventoId, setFiltroEventoId] = useState<string>('');
  const [showBulkWhatsAppModal, setShowBulkWhatsAppModal] = useState(false);

  const filteredInscricoes = inscricoes.filter((ins: any) => {
    let match = true;
    if (filtroEventoId && ins.evento_id !== filtroEventoId) match = false;
    if (enrollmentSearch) {
      const s = enrollmentSearch.toLowerCase();
      if (!ins.nome_aluno?.toLowerCase().includes(s) && 
          !ins.nome_responsavel?.toLowerCase().includes(s) &&
          !ins.categoria?.toLowerCase().includes(s)) {
        match = false;
      }
    }
    return match;
  });
"""

if "const filteredInscricoes" not in content:
    content = content.replace(target, replacement)

# 3. Fix setInscricoes
content = content.replace("setInscricoes(prev => prev.map((ins: any) => ins.id === inscricaoId ? { ...ins, checkin: checkinStatus } : ins));", "setInscricoes(inscricoes.map((ins: any) => ins.id === inscricaoId ? { ...ins, checkin: checkinStatus } : ins));")

with open('src/components/admin/courses/InscricoesTab.tsx', 'w') as f:
    f.write(content)

print("Fixed InscricoesTab")
