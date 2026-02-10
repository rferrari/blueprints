
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkData() {
    const { data: feedback, error: fError } = await supabase.from('feedback').select('*');
    console.log('Feedback Count:', feedback?.length);
    console.log('Latest Feedback:', feedback?.[0]);

    const { data: upgrade, error: uError } = await supabase.from('upgrade_feedback').select('*');
    console.log('Upgrade Feedback Count:', upgrade?.length);
    console.log('Latest Upgrade Feedback:', upgrade?.[0]);
}

checkData();
