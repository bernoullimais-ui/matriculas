import * as fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');
const wixCronCode = fs.readFileSync('scripts/wix-cron-job.ts', 'utf-8');

// Remove import axios if it exists at the top of wix-cron-job.ts (we already import axios in server.ts as import * as axios from "axios"; or import axios from "axios";)
// Actually we'll just inject the functions, not the imports
const functionCode = wixCronCode
  .replace(/import axios from 'axios';/g, '')
  .replace(/import { createClient } from '@supabase\/supabase-js';/g, '')
  .replace(/const supabase = createClient.*?;/g, '')
  .replace(/export async function syncWix/g, 'async function syncWix');

// Insert the functions right before `// Global API error handler`
content = content.replace(/\/\/ Global API error handler/, `${functionCode}\n\n  // Global API error handler`);

// Add to the cron schedule
const oldCron = `syncAllPendingPayments().catch(err => console.error('[Cron] Erro ao executar syncAllPendingPayments:', err));`;
const newCron = `syncAllPendingPayments().catch(err => console.error('[Cron] Erro ao executar syncAllPendingPayments:', err));\n        syncWixRecurringPayments().catch(err => console.error('[Cron] Erro ao executar syncWixRecurringPayments:', err));`;

content = content.replace(oldCron, newCron);

fs.writeFileSync('server.ts', content);
console.log('Injected successfully');
