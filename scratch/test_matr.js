import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const fetchAll = async (table, selectStr) => {
    let allData = [];
    let from = 0;
    let to = 999;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase.from(table).select(selectStr).order('created_at', { ascending: false }).range(from, to);
      if (error) throw error;
      allData = allData.concat(data);
      if (data.length < 1000) {
        hasMore = false;
      } else {
        from += 1000;
        to += 1000;
      }
    }
    return allData;
  };

  const matriculas = await fetchAll('matriculas', '*');
  console.log("Total returned:", matriculas.length);
  const m = matriculas.filter(x => String(x.aluno_id).trim() === '21038603-f534-496b-aa44-749f023f3ac3');
  console.log("Found:", m.length);
}
run();
