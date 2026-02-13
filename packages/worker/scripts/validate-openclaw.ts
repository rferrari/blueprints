import fs from "fs";
import path from "path";
import { OpenClawSchema } from "../../../external/openclaw/src/config/zod-schema";

const OPENCLAW_ROOT = path.resolve("../../external/openclaw");
const AGENTS_DATA_PATH = process.env.AGENTS_DATA_CONTAINER_PATH || "/mnt/agents-data";

async function main() {
    console.log("----------------------------------------------------------------");
    console.log("🔍 OpenClaw Configuration Validator");
    console.log("----------------------------------------------------------------");

    // 1. Version Reporting
    const pkgPath = path.join(OPENCLAW_ROOT, "package.json");
    if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        console.log(`✅ Running against OpenClaw version: ${pkg.version}`);

        // Developer Reminder if outdated (e.g., older than Feb 2026 for this project)
        if (pkg.version.startsWith("2025") || (pkg.version.startsWith("2026") && parseInt(pkg.version.split(".")[1]) < 2)) {
            console.warn("⚠️  [REMINDER] The local OpenClaw external repo might be outdated.");
            console.warn("   Run 'git -C external/openclaw pull' to stay in sync with latest schemas.");
        }
    } else {
        console.warn("⚠️  Could not find OpenClaw package.json for version reporting.");
    }

    console.log(`📂 Scanning agent data in: ${AGENTS_DATA_PATH}`);

    // 2. Scan & Validate Agent Configs
    if (!fs.existsSync(AGENTS_DATA_PATH)) {
        console.log("ℹ️  No agents data directory found. Skipping per-agent validation.");
        return;
    }

    const agents = fs.readdirSync(AGENTS_DATA_PATH);
    let errorCount = 0;

    for (const agentId of agents) {
        const configPath = path.join(AGENTS_DATA_PATH, agentId, "home/.openclaw/openclaw.json");

        if (fs.existsSync(configPath)) {
            process.stdout.write(`   - Validating ${agentId}... `);
            try {
                const configContent = fs.readFileSync(configPath, "utf-8");
                const config = JSON.parse(configContent);
                const result = OpenClawSchema.safeParse(config);

                if (result.success) {
                    console.log("✅ OK");
                } else {
                    // Check if all errors are just unrecognized keys
                    const onlyUnrecognizedKeys = result.error.issues.every(issue => issue.code === 'unrecognized_keys');

                    if (onlyUnrecognizedKeys) {
                        console.log("✅ OK (with warnings)");
                    } else {
                        console.log("❌ FAILED");
                        console.error(`     Error Details for ${agentId}:`);
                        console.error(JSON.stringify(result.error.format(), null, 2));
                        errorCount++;
                    }
                }
            } catch (err: any) {
                console.log("❌ ERROR");
                console.error(`     Failed to read or parse JSON for ${agentId}: ${err.message}`);
                errorCount++;
            }
        }
    }

    console.log("----------------------------------------------------------------");
    if (errorCount > 0) {
        console.error(`❌ Validation failed with ${errorCount} errors.`);
        process.exit(1);
    } else {
        console.log("🎉 All configurations are valid!");
    }
}

main().catch(err => {
    console.error("FATAL ERROR in validator:", err);
    process.exit(1);
});
