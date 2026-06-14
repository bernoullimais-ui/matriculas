import re

with open('src/components/admin/FinanceTab.tsx', 'r') as f:
    content = f.read()

# Fix the broken .toFixed(2; which was caused by the global sed command earlier
content = content.replace('.toFixed(2;', '.toFixed(2)};')
content = content.replace('.toFixed(2\n', '.toFixed(2)}\n')
content = content.replace('.toFixed(2\\n', '.toFixed(2)}\\n')

# Find the end of the finance div.
# The outermost div starts with <div className="space-y-6">
# We can find its corresponding closing div and then truncate the rest.
start_idx = content.find('<div className="space-y-6">')

# Simple tag matcher to find the matching </div>
if start_idx != -1:
    depth = 0
    idx = start_idx
    end_idx = -1
    while idx < len(content):
        if content[idx:idx+4] == '<div':
            depth += 1
        elif content[idx:idx+6] == '</div>':
            depth -= 1
            if depth == 0:
                end_idx = idx + 6
                break
        idx += 1
    
    if end_idx != -1:
        # Construct new content by slicing until end_idx, and appending the footer
        header = content[:start_idx]
        body = content[start_idx:end_idx]
        footer = "\n    </>\n  );\n}\n"
        content = header + body + footer

with open('src/components/admin/FinanceTab.tsx', 'w') as f:
    f.write(content)

print("Cleaned up FinanceTab.tsx")
