const fs = require('fs');
const file = 'src/components/admin/settings/SettingsTab.tsx';
let content = fs.readFileSync(file, 'utf8');

// Insert states
content = content.replace(
  "const [entregaCasaPreco, setEntregaCasaPreco] = useState(0);",
  "const [entregaCasaPreco, setEntregaCasaPreco] = useState(0);\n  const [optionsFilterUnidade, setOptionsFilterUnidade] = useState('');\n  const [optionsFilterProfessor, setOptionsFilterProfessor] = useState('');\n  const [isSavingFrete, setIsSavingFrete] = useState(false);\n  const [draggedId, setDraggedId] = useState<string | null>(null);"
);

// Insert functions
content = content.replace(
  "const duplicateOption = (type: string, item: any) => {};",
  "const duplicateOption = (type: string, item: any) => {};\n  const handleEditOption = (type: string, item: any) => {\n    setEditingOption(item);\n    setNewOption(item);\n  };\n  const handleSaveFrete = async () => {};\n  const handleDragStart = (e: any, id: string) => { setDraggedId(id); };\n  const handleDragOver = (e: any) => { e.preventDefault(); };\n  const handleDrop = (e: any, targetId: string) => {};\n  const handleDragEnd = () => { setDraggedId(null); };"
);

// Fix type casting string -> any
content = content.replace("prof.nome", "(prof as any).nome").replace("prof.foto_url", "(prof as any).foto_url");
content = content.replace("parc.nome", "(parc as any).nome").replace("parc.logo_url", "(parc as any).logo_url");

fs.writeFileSync(file, content, 'utf8');
console.log('Fixes applied.');
