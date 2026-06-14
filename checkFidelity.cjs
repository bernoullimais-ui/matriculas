const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://bzhvffybyoobgtdxavqi.supabase.co"; // wait, I don't know the URL. I shouldn't guess.
