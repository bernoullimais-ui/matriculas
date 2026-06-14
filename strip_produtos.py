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
    "function getCombinations",
    "const handleProductSubmit =",
    "const handleStockAddition =",
    "const handleReorderProdutos =",
    "const handleDeleteProduto =",
    "const handleImageUpload =",
    "const handleRemoveImage =",
    "const handleEditProduto =",
    "const handleDuplicateProduto =",
    "const handleDragStart =",
    "const handleDragOver =",
    "const handleDrop =",
    "const handleDragEnd =",
]

ranges = []
for b in blocks_to_remove:
    r = get_block_range(b)
    if r[0] != -1: ranges.append(r)

# Modal JSX
modal_r = get_jsx_range("tab === 'produtos' ? 'product-edit-form'")
# Wait, if we delete the modal JSX for products, the UnifiedAdmin modal has `tab === 'produtos' ? ... : ...`. 
# UnifiedAdmin still needs to handle categories and events in the global modal!
# So we shouldn't completely delete the global modal, just remove the `tab === 'produtos'` branch.

# Content JSX
content_r = get_jsx_range("{tab === 'produtos' && (")
if content_r[0] != -1: ranges.append(content_r)

# Flatten ranges and delete lines
lines_to_delete = set()
for r in ranges:
    if r[0] != -1 and r[1] != -1:
        for i in range(r[0], r[1]+1):
            lines_to_delete.add(i)

new_lines = []
for i, line in enumerate(lines):
    if i not in lines_to_delete:
        new_lines.append(line)

with open('src/pages/Admin/UnifiedAdmin.tsx', 'w') as f:
    f.writelines(new_lines)

print("Stripped logic and content block from UnifiedAdmin.tsx")
