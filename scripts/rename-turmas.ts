import fs from 'fs';

function replaceInFile(filePath: string) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const occurrences = (content.match(/turmas_complementares/g) || []).length;
  
  if (occurrences > 0) {
    content = content.replace(/turmas_complementares/g, 'turmas');
    fs.writeFileSync(filePath, content);
    console.log(`Substituiu ${occurrences} ocorrências em ${filePath}`);
  }
}

replaceInFile('server.ts');
replaceInFile('src/App.tsx');
