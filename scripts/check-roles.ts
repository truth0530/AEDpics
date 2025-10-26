import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRoles() {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, email, role')
    .limit(30);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('User Roles:');
  data?.forEach(user => {
    console.log(`${user.email}: ${user.role}`);
  });

  // Get unique roles
  const uniqueRoles = [...new Set(data?.map(u => u.role))];
  console.log('\nUnique roles found:', uniqueRoles);
}

checkRoles();
