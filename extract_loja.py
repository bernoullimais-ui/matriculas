import os

filepath = 'src/pages/Admin/UnifiedAdmin.tsx'
with open(filepath, 'r') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "const handleSaveProduto =" in line:
        print(f"handleSaveProduto starts at {i}")
    if "const handleDeleteProduto =" in line:
        print(f"handleDeleteProduto starts at {i}")
    if "tab === 'produtos'" in line:
        print(f"tab === 'produtos' found at {i}")
