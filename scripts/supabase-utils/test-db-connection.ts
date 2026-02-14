import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from backend as it has the service role key
dotenv.config({ path: path.resolve(__dirname, '../../packages/worker/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    console.log(`Connecting to: ${supabaseUrl}`);
    try {
        // Try to list tables (requires service role key or correct permissions)
        const { data, error } = await supabase
            .from('profiles')
            .select('count', { count: 'exact', head: true });

        if (error) {
            if (error.code === '42P01') {
                console.log('✅ Connection successful, but tables do not exist yet (expected for a new DB).');
            } else {
                console.error('❌ Connection failed:', error.message);
                process.exit(1);
            }
        } else {
            console.log('✅ Connection successful! Profiles table found.');
        }
    } catch (err: any) {
        console.error('❌ Unexpected error:', err.message);
        process.exit(1);
    }
}

testConnection();
