import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

const masksCode = `
// Funções de Máscara
const maskCPF = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
};

const maskPhone = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .replace(/(-\d{4})\d+?$/, '$1');
};

const maskCEP = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .replace(/(-\d{3})\d+?$/, '$1');
};
`;

if (!content.includes("maskCPF")) {
  content = content.replace("export default function App() {", masksCode + "\nexport default function App() {");
}

// Replace common onChange handlers for CPF
content = content.replace(/cpf:\s*e\.target\.value/g, 'cpf: maskCPF(e.target.value)');
content = content.replace(/telefone:\s*e\.target\.value/g, 'telefone: maskPhone(e.target.value)');
content = content.replace(/phone:\s*e\.target\.value/g, 'phone: maskPhone(e.target.value)');
content = content.replace(/cep:\s*e\.target\.value/g, 'cep: maskCEP(e.target.value)');

// For "Login" or specific fields that might use different states:
content = content.replace(/setLoginCpf\(e.target.value\)/g, 'setLoginCpf(maskCPF(e.target.value))');
content = content.replace(/setCpf\(e.target.value\)/g, 'setCpf(maskCPF(e.target.value))');
content = content.replace(/setPhone\(e.target.value\)/g, 'setPhone(maskPhone(e.target.value))');

fs.writeFileSync('src/App.tsx', content);
console.log('App.tsx updated with masks!');
