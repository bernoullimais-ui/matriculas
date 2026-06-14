import os

with open('src/pages/Admin/UnifiedAdmin.tsx', 'r') as f:
    lines = f.readlines()

def extract_block(start_marker, end_marker=None, braces=True):
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
    else:
        # Not brace based, just use end marker
        pass
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
    # For JSX, finding matching parenthesis or closing tag is tricky.
    # We look for the closing parenthesis of the condition.
    for i in range(start_idx, len(lines)):
        depth += lines[i].count('(')
        depth -= lines[i].count(')')
        if depth == 0 and lines[i].count(')') > 0:
            end_idx = i
            break
    if end_idx != -1:
        return "".join(lines[start_idx:end_idx+1])
    return ""

handleProductSubmit = extract_block("const handleProductSubmit =")
handleStockAddition = extract_block("const handleStockAddition =")
handleReorderProdutos = extract_block("const handleReorderProdutos =")
handleDeleteProduto = extract_block("const handleDeleteProduto =")
handleImageUpload = extract_block("const handleImageUpload =")
handleRemoveImage = extract_block("const handleRemoveImage =")
handleEditProduto = extract_block("const handleEditProduto =")
handleDuplicateProduto = extract_block("const handleDuplicateProduto =")
getCombinations = extract_block("const getCombinations =")

# Extract the JSX
modal_jsx = extract_jsx("tab === 'produtos' ? 'product-edit-form' : tab === 'categorias'")
content_jsx = extract_jsx("{tab === 'produtos' && (")

print("getCombinations found:", bool(getCombinations))
print("handleProductSubmit found:", bool(handleProductSubmit))
print("handleStockAddition found:", bool(handleStockAddition))
print("handleReorderProdutos found:", bool(handleReorderProdutos))
print("modal_jsx size:", len(modal_jsx.split('\n')))
print("content_jsx size:", len(content_jsx.split('\n')))
