const fs = require('fs');
const file = 'src/components/admin/ecommerce/ProdutosTab.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add is_destaque to interface
content = content.replace(
  '  destaque: boolean;',
  '  destaque: boolean;\n  is_destaque?: boolean;\n  kit_itens?: any[];'
);

// 2. Add missing state variables
const stateVars = `
  const [entradaVarianteKey, setEntradaVarianteKey] = useState<string>('default');
  const [entradaQuantidade, setEntradaQuantidade] = useState<number>(0);
  const [entradaData, setEntradaData] = useState<string>('');
`;
content = content.replace(
  '  const [isEditing, setIsEditing] = useState(false);',
  stateVars + '\n  const [isEditing, setIsEditing] = useState(false);'
);

// 3. Import formatDateTime and use it for formatDateCompact
content = content.replace(
  "import { formatCurrency } from '../../../utils/formatters';",
  "import { formatCurrency, formatDateTime } from '../../../utils/formatters';"
);
content = content.replace(/formatDateCompact\(/g, 'formatDateTime(');

// 4. Use getTodayDateString definition
content = content.replace(
  "setEntradaData(getTodayDateString());",
  "setEntradaData(new Date().toISOString().split('T')[0]);"
);

// 5. Replace stockHistory with estoqueHistorico
content = content.replace(/stockHistory/g, 'estoqueHistorico');

fs.writeFileSync(file, content);
console.log("ProdutosTab fixed!");
