import os

filepath = 'src/pages/Admin/UnifiedAdmin.tsx'
with open(filepath, 'r') as f:
    lines = f.readlines()

# 1. Inject imports
import_idx = 0
for i, line in enumerate(lines):
    if "import { LeadsTab } from '../../components/admin/LeadsTab';" in line:
        import_idx = i + 1
        break
if import_idx:
    lines.insert(import_idx, "import { FinanceTab } from '../../components/admin/FinanceTab';\n")
    lines.insert(import_idx, "import { useAdminStore } from '../../stores/adminStore';\n")

# 2. Replace states
start_logic_del = -1
end_logic_del = -1

for i, line in enumerate(lines):
    if "const [tab, setTab] = useState<string>('dashboard');" in line:
        lines[i] = "  const { tab, setTab, loading, setLoading, options, setOptions, financialData, setFinancialData } = useAdminStore();\n"
    elif "const [loading, setLoading] = useState(false);" in line:
        lines[i] = ""
    elif "const [financialData, setFinancialData] = useState<any>(null);" in line:
        lines[i] = ""
    elif "const [options, setOptions] = useState<any>({ series: [], unidades: [], turmas: [], professores: [], parceiros: [] });" in line:
        lines[i] = ""
    elif "const getFirstDayOfMonth = () => {" in line and start_logic_del == -1:
        # Before this line is "// Financial Report states". We can delete from there.
        if i > 0 and "Financial Report states" in lines[i-1]:
            start_logic_del = i - 1
        else:
            start_logic_del = i
    elif "const [filtroEventoId, setFiltroEventoId] = useState<string>('');" in line and start_logic_del != -1:
        end_logic_del = i
        break

if start_logic_del != -1 and end_logic_del != -1:
    for i in range(start_logic_del, end_logic_del):
        lines[i] = ""

# 3. Replace render block
start_render_del = -1
end_render_del = -1

for i, line in enumerate(lines):
    if "{tab === 'finance' && userRole === 'master' && (" in line:
        # Check if the previous line is {/* FINANCE TAB */}
        if i > 0 and "FINANCE TAB" in lines[i-1]:
            start_render_del = i - 1
        else:
            start_render_del = i
    if start_render_del != -1 and "{tab === 'cupons' && userRole === 'master' && (" in line:
        # The line before this is the closing `)}` and `</div>` of the finance tab.
        # Let's search backwards from this line to find the closing `)}`
        for j in range(i-1, start_render_del, -1):
            if lines[j].strip() == ")}":
                end_render_del = j
                break
        break

if start_render_del != -1 and end_render_del != -1:
    replacement = """              {/* FINANCE TAB */}
              {tab === 'finance' && userRole === 'master' && (
                <FinanceTab
                  pedidos={pedidos}
                  inscricoes={inscricoes}
                  onSyncPayments={handleSyncPayments}
                  loadingAction={loadingAction}
                />
              )}\n"""
    
    lines[start_render_del] = replacement
    for i in range(start_render_del + 1, end_render_del + 1):
        lines[i] = ""

with open(filepath, 'w') as f:
    f.writelines(lines)

print("UnifiedAdmin updated successfully.")
