import re

with open('src/components/admin/ecommerce/PedidosTab.tsx', 'r') as f:
    content = f.read()

# Add import createPortal
if "import { createPortal }" not in content:
    content = content.replace("import React, { useState } from 'react';", "import React, { useState } from 'react';\nimport { createPortal } from 'react-dom';")

# Find the modal return
modal_return_pattern = r'return \(\n\s*<div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">\n\s*<div className="bg-white rounded-3xl w-full max-w-3xl max-h-\[90vh\] overflow-y-auto shadow-2xl relative p-6">'

replacement = """return createPortal(
          <AnimatePresence>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl relative p-6"
              >"""

content = re.sub(modal_return_pattern, replacement, content)

# Fix the end of the modal
modal_end_pattern = r'            </div>\n          </div>\n        \);\n      \}\)\(\)\}'

replacement_end = """              </motion.div>
            </motion.div>
          </AnimatePresence>,
          document.body
        );
      })()}"""

content = re.sub(modal_end_pattern, replacement_end, content)

with open('src/components/admin/ecommerce/PedidosTab.tsx', 'w') as f:
    f.write(content)

print("Patched modal.")
