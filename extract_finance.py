import os

# 1. Read UnifiedAdmin.tsx
with open('src/pages/Admin/UnifiedAdmin.tsx', 'r') as f:
    lines = f.readlines()

# 2. Extract logic (lines 317 to 410)
# Actually, the start line is "const computedFinance = React.useMemo(() => {"
# The end of logic is after handleExportCSV closes.

start_logic = 0
end_logic = 0
for i, line in enumerate(lines):
    if 'const computedFinance = React.useMemo(() => {' in line:
        start_logic = i
    if start_logic and 'const [filtroEventoId, setFiltroEventoId]' in line:
        end_logic = i
        break

logic_lines = lines[start_logic:end_logic]

# 3. Extract render block
start_render = 0
end_render = 0
for i, line in enumerate(lines):
    if "{tab === 'finance' && userRole === 'master' && (" in line:
        start_render = i
    if start_render and "{tab === 'cupons' && userRole === 'master' && (" in line:
        end_render = i
        break

render_lines = lines[start_render:end_render]
# Render lines contain the closing tag for the finance block. We need to strip the `{tab === 'cupons'...` line.

# 4. We also need to extract local state variables:
# const [finStartDate, setFinStartDate]
# const [finEndDate, setFinEndDate]
# const [finSelectedUnit, setFinSelectedUnit]
# const [finSelectedProf, setFinSelectedProf]
# const [isFinProfDropdownOpen, setIsFinProfDropdownOpen]
# const [finSearchStudent, setFinSearchStudent]
# const [finPrimaryTab, setFinPrimaryTab]
# const [finSecondaryTab, setFinSecondaryTab]

states = []
for i, line in enumerate(lines):
    if 'const [fin' in line or 'const [isFin' in line:
        states.append(line)

with open('finance_states.txt', 'w') as f:
    f.writelines(states)

with open('finance_logic_extracted.txt', 'w') as f:
    f.writelines(logic_lines)

with open('finance_render_extracted.txt', 'w') as f:
    f.writelines(render_lines)

print(f"Logic: {start_logic}-{end_logic}")
print(f"Render: {start_render}-{end_render}")
