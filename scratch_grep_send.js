import fs from 'fs';
const file = fs.readFileSync('server.ts', 'utf-8');
const lines = file.split('\n');
const startIndex = lines.findIndex(l => l.includes('app.post("/api/admin/whatsapp/send"'));
console.log(lines.slice(startIndex, startIndex + 50).join('\n'));
