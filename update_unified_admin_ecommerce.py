import os

filepath = 'src/pages/Admin/UnifiedAdmin.tsx'
with open(filepath, 'r') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "const { tab, setTab, loading, setLoading, options, setOptions, financialData, setFinancialData } = useAdminStore();" in line:
        lines[i] = "  const { tab, setTab, loading, setLoading, options, setOptions, financialData, setFinancialData, produtos, setProdutos, categorias, setCategorias, pedidos, setPedidos } = useAdminStore();\n"
    elif "const [produtos, setProdutos] = useState<Produto[]>([]);" in line:
        lines[i] = ""
    elif "const [categorias, setCategorias] = useState<Categoria[]>([]);" in line:
        lines[i] = ""
    elif "const [pedidos, setPedidos] = useState<any[]>([]);" in line:
        lines[i] = ""

with open(filepath, 'w') as f:
    f.writelines(lines)

print("Updated state definitions in UnifiedAdmin.tsx")
