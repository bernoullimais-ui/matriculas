import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { data } = await supabase.from('website_configs').select('*').limit(1).maybeSingle();
  console.log(JSON.stringify(data.hero_carousel, null, 2));
  console.log(JSON.stringify(data.testimonials, null, 2));
}
test();
