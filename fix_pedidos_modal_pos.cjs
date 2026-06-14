const fs = require('fs');
const file = 'src/components/admin/ecommerce/PedidosTab.tsx';
let content = fs.readFileSync(file, 'utf8');

const startMarker = 'const [pedidoDetailModal, setPedidoDetailModal] = useState({ isOpen: false, pedido: null as any });';
const returnMarker = '  return (';
const endMarker = '    </>';

const startIndex = content.indexOf(startMarker) + startMarker.length;
const returnIndex = content.indexOf(returnMarker);

if (startIndex === -1 || returnIndex === -1) {
  console.log('Markers not found');
  process.exit(1);
}

// Extract the floating block
const floatingBlock = content.substring(startIndex, returnIndex);

// Remove the floating block from its original position
let newContent = content.substring(0, startIndex) + '\n\n' + content.substring(returnIndex);

// Insert the floating block right before `    </>`
newContent = newContent.replace('    </>', floatingBlock + '\n    </>');

fs.writeFileSync(file, newContent);
console.log('PedidosTab modal moved inside return');
