import re

with open('src/components/admin/courses/InscricoesTab.tsx', 'r') as f:
    content = f.read()

# 1. Import MessageCircle and Info
import_lucide_pattern = r'import \{([\s\S]*?)\} from \'lucide-react\';'
def add_icons(match):
    icons = match.group(1)
    if 'MessageCircle' not in icons:
        icons += ', MessageCircle'
    if 'Info' not in icons:
        icons += ', Info'
    return f"import {{{icons}}} from 'lucide-react';"

content = re.sub(import_lucide_pattern, add_icons, content)

# 2. Add showBulkWhatsAppModal state
state_pattern = r'const \[filtroEventoId, setFiltroEventoId\] = useState<string>\(\'\'\);'
state_replacement = "const [filtroEventoId, setFiltroEventoId] = useState<string>('');\n  const [showBulkWhatsAppModal, setShowBulkWhatsAppModal] = useState(false);"
content = content.replace(state_pattern, state_replacement)

# 3. Add filteredInscricoes definition
filtered_def = """
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
content = content.replace(state_replacement, state_replacement + "\n" + filtered_def)

# 4. Fix setInscricoes callback
set_insc_pattern = r'setInscricoes\(prev => prev\.map\(\(ins: any\) => ins\.id === inscricaoId \? \{ \.\.\.ins, checkin: checkinStatus \} : ins\)\);'
set_insc_replacement = "setInscricoes(inscricoes.map((ins: any) => ins.id === inscricaoId ? { ...ins, checkin: checkinStatus } : ins));"
content = re.sub(set_insc_pattern, set_insc_replacement, content)

with open('src/components/admin/courses/InscricoesTab.tsx', 'w') as f:
    f.write(content)

print("Patched InscricoesTab")
