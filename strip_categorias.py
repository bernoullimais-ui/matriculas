import os

with open('src/pages/Admin/UnifiedAdmin.tsx', 'r') as f:
    lines = f.readlines()

def get_block_range(start_marker, braces=True):
    start_idx = -1
    for i, line in enumerate(lines):
        if start_marker in line:
            start_idx = i
            break
    if start_idx == -1: return (-1, -1)
    
    if braces:
        depth = 0
        end_idx = -1
        for i in range(start_idx, len(lines)):
            depth += lines[i].count('{')
            depth -= lines[i].count('}')
            if depth == 0 and lines[i].count('}') > 0:
                end_idx = i
                break
        return (start_idx, end_idx)
    return (-1, -1)

def get_jsx_range(start_marker):
    start_idx = -1
    for i, line in enumerate(lines):
        if start_marker in line:
            start_idx = i
            break
    if start_idx == -1: return (-1, -1)
    
    depth = 0
    end_idx = -1
    for i in range(start_idx, len(lines)):
        depth += lines[i].count('(')
        depth -= lines[i].count(')')
        if depth == 0 and lines[i].count(')') > 0:
            end_idx = i
            break
    return (start_idx, end_idx)

blocks_to_remove = [
    "const handleSaveFrete =",
    "const handleCategoriaSubmit =",
    "const handleEditCategoria =",
    "const handleDeleteCategoria =",
]

ranges = []
for b in blocks_to_remove:
    r = get_block_range(b)
    if r[0] != -1: ranges.append(r)

modal_r = get_jsx_range("tab === 'categorias' ? 'category-edit-form'")
content_r = get_jsx_range("{tab === 'categorias' && (")
if content_r[0] != -1: ranges.append(content_r)

lines_to_delete = set()
for r in ranges:
    if r[0] != -1 and r[1] != -1:
        for i in range(r[0], r[1]+1):
            lines_to_delete.add(i)

new_lines = []
for i, line in enumerate(lines):
    if i not in lines_to_delete:
        new_lines.append(line)

# Remove states
states_to_remove = [
    "const [categoriaForm, setCategoriaForm]",
    "const [categoriasSubTab, setCategoriasSubTab]",
    "const [entregaCasaHabilitada, setEntregaCasaHabilitada]",
    "const [entregaCasaPreco, setEntregaCasaPreco]",
    "const [isSavingFrete, setIsSavingFrete]"
]

filtered_lines = []
for line in new_lines:
    remove = False
    for s in states_to_remove:
        if s in line:
            remove = True
            break
    if not remove:
        filtered_lines.append(line)

# Inject import and component
import_idx = -1
render_idx = -1

for i, line in enumerate(filtered_lines):
    if "import { ProdutosTab }" in line:
        import_idx = i + 1
    if "              {tab === 'produtos' && <ProdutosTab />}" in line:
        render_idx = i + 1

if import_idx != -1:
    filtered_lines.insert(import_idx, "import { CategoriasTab } from '../../components/admin/ecommerce/CategoriasTab';\n")

# Re-evaluate render_idx because array grew by 1
render_idx = -1
for i, line in enumerate(filtered_lines):
    if "              {tab === 'produtos' && <ProdutosTab />}" in line:
        render_idx = i + 1

if render_idx != -1:
    filtered_lines.insert(render_idx, "              {tab === 'categorias' && <CategoriasTab />}\n")

with open('src/pages/Admin/UnifiedAdmin.tsx', 'w') as f:
    f.writelines(filtered_lines)

print("CategoriasTab cleanly integrated.")
