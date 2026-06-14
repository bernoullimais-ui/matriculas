import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("Creating bucket...");
  const { data, error } = await supabase.storage.createBucket('whatsapp-media', {
    public: true,
    fileSizeLimit: 52428800, // 50MB
  });
  
  if (error) {
    console.error("Bucket creation error:", error);
  } else {
    console.log("Bucket created successfully:", data);
  }
}
run();
