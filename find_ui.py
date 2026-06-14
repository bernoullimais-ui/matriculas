import json

with open('/Users/brunomaia/.gemini/antigravity/brain/686ad4a9-2b2a-4401-bd30-7af6c2311c24/.system_generated/logs/transcript_full.jsonl', 'r') as f:
    for line in f:
        try:
            data = json.loads(line)
            content = str(data.get('content', '')) + str(data.get('output', ''))
            
            # Let's search for something that must exist in the JSX
            if "Cupons da Loja" in content or "cuponsSubTab === 'cursos'" in content or "cuponsSubTab" in content:
                print("Found match! Length:", len(content))
                if len(content) > 1000:
                    with open('found_ui.txt', 'w') as out:
                        out.write(content)
                    break
        except Exception as e:
            pass
