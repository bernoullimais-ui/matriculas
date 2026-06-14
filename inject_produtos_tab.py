import os

with open('src/pages/Admin/UnifiedAdmin.tsx', 'r') as f:
    lines = f.readlines()

# Inject import
import_idx = 0
for i, line in enumerate(lines):
    if "import { FinanceTab } from '../../components/admin/FinanceTab';" in line:
        import_idx = i + 1
        break

if import_idx:
    lines.insert(import_idx, "import { ProdutosTab } from '../../components/admin/ecommerce/ProdutosTab';\n")

# Inject component
render_idx = -1
for i, line in enumerate(lines):
    if "{tab === 'finance' && userRole === 'master' && (" in line:
        render_idx = i
        break

if render_idx != -1:
    lines.insert(render_idx, "              {tab === 'produtos' && <ProdutosTab />}\n")

with open('src/pages/Admin/UnifiedAdmin.tsx', 'w') as f:
    f.writelines(lines)

print("Injected ProdutosTab into UnifiedAdmin.tsx")
