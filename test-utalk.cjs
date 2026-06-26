const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
console.log('UTALK_TOKEN:', process.env.UTALK_TOKEN ? 'EXISTS' : 'MISSING');
