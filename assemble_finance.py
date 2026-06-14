import os

with open('finance_states.txt', 'r') as f:
    states = f.read()

with open('finance_logic_extracted.txt', 'r') as f:
    logic = f.read()

with open('finance_render_extracted.txt', 'r') as f:
    render = f.read()

# Strip the {tab === 'finance' && userRole === 'master' && (
lines = render.split('\n')
if len(lines) > 2 and "tab === 'finance'" in lines[1]:
    lines[1] = "" # clear the wrapper
    
# Remove the last )} which closes the block
for i in range(len(lines)-1, -1, -1):
    if lines[i].strip() == ')}':
        lines[i] = ""
        break

render = '\n'.join(lines)

component_code = f"""import React, {{ useState }} from 'react';
import {{ Download, RefreshCw, User, MapPin, Search, ChevronDown, CheckCircle2, AlertTriangle, AlertCircle }} from 'lucide-react';
import {{ formatDateDisplay }} from '../../utils/dateUtils';
import {{ useAdminStore }} from '../../stores/adminStore';

interface FinanceTabProps {{
  pedidos: any[];
  inscricoes: any[];
  onSyncPayments: () => void;
  loadingAction: boolean;
}}

export function FinanceTab({{ pedidos, inscricoes, onSyncPayments, loadingAction }}: FinanceTabProps) {{
  const {{ options, financialData }} = useAdminStore();

  const getFirstDayOfMonth = () => {{
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  }};

  const getLastDayOfMonth = () => {{
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
  }};

  const [finStartDate, setFinStartDate] = useState(getFirstDayOfMonth());
  const [finEndDate, setFinEndDate] = useState(getLastDayOfMonth());
  const [finSelectedUnit, setFinSelectedUnit] = useState('');
  const [finSelectedProf, setFinSelectedProf] = useState<string[]>([]);
  const [isFinProfDropdownOpen, setIsFinProfDropdownOpen] = useState(false);
  const [finSearchStudent, setFinSearchStudent] = useState('');
  const [finPrimaryTab, setFinPrimaryTab] = useState<'projetada' | 'aferida' | 'inadimplencias'>('aferida');
  const [finSecondaryTab, setFinSecondaryTab] = useState<'professor' | 'unidade' | 'detalhado' | 'sem_integral' | 'estudantes_integral' | 'wix' | 'pagarme' | 'comissionamento' | ''>('wix');

{logic}

  return (
    <>
{render}
    </>
  );
}}
"""

with open('src/components/admin/FinanceTab.tsx', 'w') as f:
    f.write(component_code)

print("FinanceTab correctly generated.")
