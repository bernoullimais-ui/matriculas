const fs = require('fs');
const file = 'src/components/admin/ecommerce/PedidosTab.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add Printer to lucide-react imports
content = content.replace(
  "  Search, X, Check, Eye, Archive, MapPin, Phone, MessageSquare, AlertCircle, RefreshCw, ExternalLink, Trash2",
  "  Search, X, Check, Eye, Archive, MapPin, Phone, MessageSquare, AlertCircle, RefreshCw, ExternalLink, Trash2, Printer"
);

// Add enrollments to useAdminStore
content = content.replace(
  "const { pedidos, setPedidos, loadData } = useAdminStore();",
  "const { pedidos, setPedidos, loadData, enrollments } = useAdminStore();"
);

fs.writeFileSync(file, content);
console.log("PedidosTab printer and enrollments fixed!");
