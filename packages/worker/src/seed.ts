import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function seed() {
    console.log('--- Seeding Local Runtime ---');

    const localRuntime = {
        name: 'Local Eliza Runtime',
        eliza_api_url: 'http://localhost:3000/api', // Default ElizaOS port
        auth_token: 'secret-token' // this should match ElizaOS config
    };

    const { data, error } = await supabase
        .from('runtimes')
        .upsert(localRuntime, { onConflict: 'name' })
        .select()
        .single();

    if (error) {
        console.error('Error seeding runtime:', error.message);
    } else {
        console.log('Local runtime seeded successfully:', data.id);
    }
}

seed();
