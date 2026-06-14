import json

with open('/Users/brunomaia/.gemini/antigravity/brain/686ad4a9-2b2a-4401-bd30-7af6c2311c24/.system_generated/logs/transcript_full.jsonl', 'r') as f:
    for line in f:
        data = json.loads(line)
        content = str(data.get('content', '')) + str(data.get('output', ''))
        # We want the actual JSX, so we look for className and some known text
        if '{showInscricaoDetails && (' in content and 'className=' in content and 'export default function UnifiedAdmin' in content:
            with open('original_unified_admin.txt', 'w') as out:
                out.write(content)
            print("Found and saved!")
            break

