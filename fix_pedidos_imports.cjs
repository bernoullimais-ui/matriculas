const fs = require('fs');
const file = 'src/components/admin/ecommerce/PedidosTab.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add toast
if (!content.includes("import toast")) {
  content = content.replace(
    "import { motion, AnimatePresence } from 'motion/react';",
    "import { motion, AnimatePresence } from 'motion/react';\nimport toast from 'react-hot-toast';"
  );
}

// 2. Add ExternalLink and Trash2 to lucide-react
content = content.replace(
  "  Search, X, Check, Eye, Archive, MapPin, Phone, MessageSquare, AlertCircle, RefreshCw",
  "  Search, X, Check, Eye, Archive, MapPin, Phone, MessageSquare, AlertCircle, RefreshCw, ExternalLink, Trash2"
);

// 3. Add loadData to useAdminStore
content = content.replace(
  "const { pedidos, setPedidos } = useAdminStore();",
  "const { pedidos, setPedidos, loadData } = useAdminStore();"
);

fs.writeFileSync(file, content);
console.log("PedidosTab fixed!");
