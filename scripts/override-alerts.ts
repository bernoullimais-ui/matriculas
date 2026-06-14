import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Adiciona o import se não existir
if (!content.includes("import toast from 'react-hot-toast'")) {
  content = content.replace("import React,", "import toast from 'react-hot-toast';\nimport React,");
}

const overrideCode = `
// Intercepta alertas nativos para usar o react-hot-toast
if (typeof window !== 'undefined') {
  window.alert = (message) => {
    if (!message) return;
    const msgStr = String(message).toLowerCase();
    if (msgStr.includes('erro') || msgStr.includes('inválido') || msgStr.includes('obrigatório') || msgStr.includes('incorreta') || msgStr.includes('rejeitada') || msgStr.includes('falha')) {
      toast.error(String(message));
    } else if (msgStr.includes('sucesso') || msgStr.includes('aprovada') || msgStr.includes('concluída')) {
      toast.success(String(message));
    } else {
      toast(String(message));
    }
  };
}
`;

if (!content.includes("Intercepta alertas nativos")) {
  content = content.replace("export default function App() {", overrideCode + "\nexport default function App() {");
}

fs.writeFileSync('src/App.tsx', content);
console.log('App.tsx updated with global alert override!');
