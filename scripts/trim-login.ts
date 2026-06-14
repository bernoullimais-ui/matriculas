import * as fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

content = content.replace(
  /const \{ email, password \} = req\.body \|\| \{\};/,
  "const email = (req.body?.email || '').trim();\n    const password = (req.body?.password || '').trim();"
);

fs.writeFileSync('server.ts', content);
console.log('Added trim() to login');
