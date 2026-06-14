import json

transcript_path = '/Users/brunomaia/.gemini/antigravity/brain/686ad4a9-2b2a-4401-bd30-7af6c2311c24/.system_generated/logs/transcript_full.jsonl'

with open(transcript_path, 'r') as f:
    for line in f:
        try:
            data = json.loads(line)
        except:
            continue
        
        if data.get('type') == 'TOOL_RESPONSE':
            content = data.get('content', '')
            if 'export default function UnifiedAdmin' in content and 'produtos' in content:
                print("Found match in a tool response of length:", len(content))
                with open('/tmp/recovered_UnifiedAdmin.tsx', 'w') as out_f:
                    out_f.write(content)
                break
