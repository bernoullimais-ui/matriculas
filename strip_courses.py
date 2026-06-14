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
    "const handleEventoSubmit =",
    "const handleDeleteEvento =",
    "const handleCheckin =",
    "const handleUpdateInscricao =",
    "const handleDeleteInscricao =",
    "const handleEditInscricao =",
    "const handleCouponSubmit =",
    "const handleCouponEditSave =",
]

ranges = []
for b in blocks_to_remove:
    r = get_block_range(b)
    if r[0] != -1: ranges.append(r)

ranges.append(get_jsx_range("tab === 'eventos' ? 'event-edit-form'"))
ranges.append(get_jsx_range("{tab === 'eventos' && ("))
ranges.append(get_jsx_range("{tab === 'inscricoes' && ("))
ranges.append(get_jsx_range("{showInscricaoDetails && ("))
ranges.append(get_jsx_range("{showInscricaoEdit && ("))
ranges.append(get_jsx_range("{tab === 'cupons' && ("))

lines_to_delete = set()
for r in ranges:
    if r[0] != -1 and r[1] != -1:
        for i in range(r[0], r[1]+1):
            lines_to_delete.add(i)

new_lines = []
for i, line in enumerate(lines):
    if i not in lines_to_delete:
        new_lines.append(line)

states_to_remove = [
    "const [eventoForm, setEventoForm]",
    "const [newCategoryName, setNewCategoryName]",
    "const [newPriceOptionName, setNewPriceOptionName]",
    "const [newPriceOptionPrice, setNewPriceOptionPrice]",
    "const [newFieldLabel, setNewFieldLabel]",
    "const [newFieldTipo, setNewFieldTipo]",
    "const [newFieldOpcoes, setNewFieldOpcoes]",
    "const [newFieldObrigatorio, setNewFieldObrigatorio]",
    "const [enrollmentSearch, setEnrollmentSearch]",
    "const [filtroEventoId, setFiltroEventoId]",
    "const [editingCupomId, setEditingCupomId]",
    "const [cupomEditForm, setCupomEditForm]",
    "const [cupomForm, setCupomForm]",
    "const [cupomCursoForm, setCupomCursoForm]",
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

import_idx = -1
for i, line in enumerate(filtered_lines):
    if "import { PedidosTab }" in line:
        import_idx = i + 1

if import_idx != -1:
    filtered_lines.insert(import_idx, "import { EventosTab } from '../../components/admin/courses/EventosTab';\nimport { InscricoesTab } from '../../components/admin/courses/InscricoesTab';\nimport { CuponsTab } from '../../components/admin/courses/CuponsTab';\n")

render_idx = -1
for i, line in enumerate(filtered_lines):
    if "              {tab === 'pedidos' && <PedidosTab />}" in line:
        render_idx = i + 1

if render_idx != -1:
    filtered_lines.insert(render_idx, "              {tab === 'eventos' && <EventosTab />}\n              {tab === 'inscricoes' && <InscricoesTab />}\n              {tab === 'cupons' && <CuponsTab />}\n")

with open('src/pages/Admin/UnifiedAdmin.tsx', 'w') as f:
    f.writelines(filtered_lines)

print("Courses tabs seamlessly integrated!")
