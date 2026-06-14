import os

with open('src/pages/Admin/UnifiedAdmin.tsx', 'r') as f:
    lines = f.readlines()

start_idx = -1
for i, line in enumerate(lines):
    if "              {tab === 'produtos' && (" in line and "product-edit-form" in "".join(lines[max(0, i-20):i]):
        start_idx = i
        break

if start_idx != -1:
    depth = 0
    end_idx = -1
    for i in range(start_idx, len(lines)):
        depth += lines[i].count('(')
        depth -= lines[i].count(')')
        if depth == 0 and lines[i].count(')') > 0:
            end_idx = i
            break
    
    if end_idx != -1:
        with open('produto_modal_extracted.txt', 'w') as f:
            f.write("".join(lines[start_idx:end_idx+1]))
        print("Extracted modal!")
    else:
        print("End not found")
else:
    print("Start not found")

