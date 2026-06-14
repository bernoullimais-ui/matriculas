import * as dotenv from 'dotenv';
dotenv.config();

import { syncWixRecurringPayments } from './wix-cron-job';
import { createClient } from '@supabase/supabase-js';

// redefine supabase inside here so it uses dotenv
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(global as any).supabase = supabase; // in case the module uses global supabase

syncWixRecurringPayments().then(() => console.log('Teste finalizado!'));
