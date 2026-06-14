import * as fs from 'fs';

const content = fs.readFileSync('/Users/brunomaia/Developer/matrícula-online-sport-for-kids/src/pages/Admin/UnifiedAdmin.tsx', 'utf8');

const lines = content.split('\n');
const startLine = 705;
const endLine = 720;

const stack: { char: string; line: number; col: number }[] = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const lineNum = i + 1;
  
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '(' || char === '{' || char === '[') {
      stack.push({ char, line: lineNum, col: j + 1 });
    } else if (char === ')' || char === '}' || char === ']') {
      if (stack.length > 0) {
        const top = stack.pop()!;
        const expected = char === ')' ? '(' : char === '}' ? '{' : '[';
        if (top.char !== expected && lineNum >= startLine && lineNum <= endLine) {
          console.log(`Mismatch at line ${lineNum}: closed '${char}' but top of stack was '${top.char}' from line ${top.line}`);
        }
      }
    }
  }
  
  if (lineNum >= startLine && lineNum <= endLine) {
    // Print stack status
    const stackStr = stack.map(s => s.char).join('');
    console.log(`Line ${lineNum}: ${stackStr} | Content: ${line.trim().substring(0, 40)}`);
  }
}
