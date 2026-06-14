import * as fs from 'fs';

const content = fs.readFileSync('/Users/brunomaia/Developer/matrícula-online-sport-for-kids/src/pages/Admin/UnifiedAdmin.tsx', 'utf8');

const stack: { char: string; line: number; col: number }[] = [];
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '(' || char === '{' || char === '[') {
      stack.push({ char, line: i + 1, col: j + 1 });
    } else if (char === ')' || char === '}' || char === ']') {
      if (stack.length === 0) {
        console.log(`Mismatched closing character '${char}' at line ${i + 1}, column ${j + 1}`);
      } else {
        const top = stack.pop()!;
        const expected = char === ')' ? '(' : char === '}' ? '{' : '[';
        if (top.char !== expected) {
          console.log(`Mismatched characters: opened '${top.char}' at line ${top.line}, column ${top.col} but closed with '${char}' at line ${i + 1}, column ${j + 1}`);
        }
      }
    }
  }
}

if (stack.length > 0) {
  console.log(`Unclosed characters left in stack:`);
  stack.forEach(s => {
    console.log(`- '${s.char}' at line ${s.line}, column ${s.col}`);
  });
} else {
  console.log('No mismatched brackets found!');
}
