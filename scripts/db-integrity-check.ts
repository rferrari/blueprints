import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    const schemaPath = path.join(__dirname, '../migrations/schema.sql');

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing Supabase credentials (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)');
        process.exit(1);
    }

    if (!fs.existsSync(schemaPath)) {
        console.error(`❌ Schema file not found at ${schemaPath}`);
        process.exit(1);
    }

    console.log('📖 Reading schema.sql...');
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

    // Simple regex to extract tables and columns
    const tables: Record<string, string[]> = {};
    let currentTable: string | null = null;

    const lines = schemaContent.split('\n');
    for (const line of lines) {
        // Match table definitions (case insensitive, optional public. prefix)
        const createTableMatch = line.match(/create table (?:if not exists\s+)?(?:public\.)?(\w+)\s*\(/i);
        if (createTableMatch) {
            currentTable = createTableMatch[1];
            tables[currentTable] = [];
            continue;
        }

        // Match end of table definition
        if (currentTable && line.trim().startsWith(');')) {
            currentTable = null;
            continue;
        }

        if (currentTable) {
            // Match column names (first word if it starts with spaces and isn't a constraint)
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('--')) continue;

            const colMatch = trimmedLine.match(/^(\w+)\s+/);
            if (colMatch) {
                const colName = colMatch[1].toLowerCase();
                const reservedWords = ['primary', 'foreign', 'constraint', 'unique', 'check', 'references', 'alter', 'drop', 'policy', 'create', 'on'];
                if (!reservedWords.includes(colName)) {
                    tables[currentTable].push(colMatch[1]);
                }
            }
        }
    }

    console.log(`✅ Parsed ${Object.keys(tables).length} tables from schema.sql`);

    console.log('🌐 Fetching live schema from Supabase...');
    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const openapi = await response.json();
        const liveTables = openapi.definitions || {};

        console.log('\n🔍 Comparing Schemas...\n');
        let issues = 0;

        for (const [tableName, expectedCols] of Object.entries(tables)) {
            if (!liveTables[tableName]) {
                console.error(`❌ Table '${tableName}' is MISSING in live database!`);
                issues++;
                continue;
            }

            const liveCols = Object.keys(liveTables[tableName].properties || {}).map(c => c.toLowerCase());
            const missingCols = expectedCols.filter(col => !liveCols.includes(col.toLowerCase()));

            if (missingCols.length > 0) {
                console.error(`❌ Table '${tableName}' is missing columns: ${missingCols.join(', ')}`);
                issues += missingCols.length;
            } else {
                console.log(`✅ Table '${tableName}' is synchronized.`);
            }
        }

        if (issues === 0) {
            console.log('\n✨ Database integrity check PASSED! All tables and columns match schema.sql.');
            process.exit(0);
        } else {
            console.error(`\n⚠️ Database integrity check FAILED with ${issues} issues.`);
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Failed to fetch live schema:', error);
        process.exit(1);
    }
}

main();
