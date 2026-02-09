import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const table = process.argv[2];
    const filterJson = process.argv[3];
    const limit = parseInt(process.argv[4] || '10');

    if (!table) {
        console.log('Usage: bun run scripts/debug-db.ts <table> [filter_json] [limit]');
        console.log('Example: bun run scripts/debug-db.ts agents \'{"id": "123"}\'');
        return;
    }

    let query = supabase.from(table).select('*');

    if (filterJson) {
        try {
            const filters = JSON.parse(filterJson);
            for (const [key, value] of Object.entries(filters)) {
                query = query.eq(key, value);
            }
        } catch (e: any) {
            console.error('Invalid filter JSON:', e.message);
            return;
        }
    }

    query = query.limit(limit);

    const { data, error } = await query;

    if (error) {
        console.error('Database Error:', error);
    } else {
        console.log(`Results from '${table}':`);
        console.log(JSON.stringify(data, null, 2));
    }
}

main();
