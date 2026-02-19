#!/usr/bin/env bun
/**
 * Script: check-openrouter-keys.ts
 * Description: Interacts with the OpenRouter API to manage keys.
 * 
 * Pre-requisites:
 * 1. Install the OpenRouter SDK: `bun add @openrouter/sdk`
 * 2. Set your management key in the script or environment variable.
 * 
 * Usage:
 * bun run scripts/check-openrouter-keys.ts
 */

import { OpenRouter } from '@openrouter/sdk';

const MANAGEMENT_KEY = process.env.OPENROUTER_MANAGEMENT_KEY || 'your-management-key';

if (MANAGEMENT_KEY === 'your-management-key') {
    console.error('Please set your OPENROUTER_MANAGEMENT_KEY environment variable or edit the script.');
    process.exit(1);
}

const openRouter = new OpenRouter({
    apiKey: MANAGEMENT_KEY,
});

async function main() {
    try {
        console.log('--- Listing API Keys ---');
        // List the most recent 100 API keys
        const keys = await openRouter.apiKeys.list();
        console.log(`Found ${keys.data.length} keys.`);
        console.log(keys.data);

        // You can paginate using the offset parameter
        // const keysPage2 = await openRouter.apiKeys.list({ offset: 100 });

        /* 
        // Example: Create a new API key
        const newKey = await openRouter.apiKeys.create({
          name: 'Customer Instance Key',
          limit: 1000, // Optional credit limit
        });
        console.log('Created Key:', newKey);
        */

        /*
        // Example: Get a specific key
        const keyHash = '<YOUR_KEY_HASH>';
        const key = await openRouter.apiKeys.get(keyHash);
        console.log('Retrieved Key:', key);
        */

        /*
        // Example: Update a key
        const updatedKey = await openRouter.apiKeys.update(keyHash, {
          name: 'Updated Key Name',
          disabled: true, // Optional: Disable the key
          includeByokInLimit: false, // Optional: control BYOK usage in limit
          limitReset: 'daily', // Optional: reset limit every day at midnight UTC
        });
        console.log('Updated Key:', updatedKey);
        */

        /*
        // Example: Delete a key
        await openRouter.apiKeys.delete(keyHash);
        console.log('Deleted Key:', keyHash);
        */

    } catch (error) {
        console.error('Error interacting with OpenRouter:', error);
    }
}

main();
