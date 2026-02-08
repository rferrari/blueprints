import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load env from root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const action = process.argv[2]; // 'start' or 'finish'

    if (action === 'start') {
        const commitHash = process.argv[3];
        const branch = process.argv[4];
        const message = process.argv[5];

        const { data, error } = await supabase
            .from('deployments')
            .insert({
                commit_hash: commitHash,
                branch: branch,
                message: message,
                status: 'pending'
            })
            .select('id')
            .single();

        if (error) {
            console.error('Error creating deployment record:', error);
            process.exit(1);
        }

        console.log(data.id);
    } else if (action === 'finish') {
        const id = process.argv[3];
        const status = process.argv[4]; // 'success' or 'failed'

        const { error } = await supabase
            .from('deployments')
            .update({
                status: status,
                finished_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) {
            console.error('Error updating deployment record:', error);
            process.exit(1);
        }

        console.log('Deployment record updated.');
    } else {
        console.log('Usage: bun run scripts/record-deployment.ts <start|finish> ...');
    }
}

main();
