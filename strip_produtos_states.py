import os

with open('src/pages/Admin/UnifiedAdmin.tsx', 'r') as f:
    lines = f.readlines()

states_to_remove = [
    "const [produtoForm, setProdutoForm]",
    "const [imagensInputText, setImagensInputText]",
    "const [newVariantType, setNewVariantType]",
    "const [newVariantOptions, setNewVariantOptions]",
    "const [addStockQty, setAddStockQty]",
    "const [addStockDate, setAddStockDate]",
    "const [kitItens, setKitItens]",
    "const [selectedKitComponentProduct, setSelectedKitComponentProduct]",
    "const [selectedKitComponentVariant, setSelectedKitComponentVariant]",
    "const [selectedKitComponentQty, setSelectedKitComponentQty]",
    "const [variantTypeInput, setVariantTypeInput]",
    "const [lojaProdutosSubTab, setLojaProdutosSubTab]",
    "const [estoqueHistorico, setEstoqueHistorico]",
    "const [loadingEstoqueHistorico, setLoadingEstoqueHistorico]",
    "const [estoqueFilterProduto, setEstoqueFilterProduto]",
    "const [estoqueFilterStartDate, setEstoqueFilterStartDate]",
    "const [estoqueFilterEndDate, setEstoqueFilterEndDate]",
    "const [variantOptionsInput, setVariantOptionsInput]"
]

new_lines = []
for line in lines:
    remove = False
    for s in states_to_remove:
        if s in line:
            remove = True
            break
    if not remove:
        new_lines.append(line)

with open('src/pages/Admin/UnifiedAdmin.tsx', 'w') as f:
    f.writelines(new_lines)

print("Stripped states from UnifiedAdmin.tsx")
