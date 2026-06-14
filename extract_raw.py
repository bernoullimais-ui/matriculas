import json

with open('/Users/brunomaia/.gemini/antigravity/brain/686ad4a9-2b2a-4401-bd30-7af6c2311c24/.system_generated/logs/transcript_full.jsonl', 'r') as f:
    for line in f:
        try:
            data = json.loads(line)
            content = str(data.get('content', '')) + str(data.get('output', ''))
            
            idx = content.find("{tab === 'cupons' && (")
            if idx != -1 and "className=" in content:
                print("FOUND!")
                # Get the relevant lines around it
                snippet = content[idx:idx+8000]
                with open('cupons_snippet.txt', 'w') as out:
                    out.write(snippet)
                break
        except Exception as e:
            pass
