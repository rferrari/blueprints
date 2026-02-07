import crypto from 'node:crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-32-chars-long-12345'; // fallback for dev
const ENCRYPTION_KEY_BUFFER = Buffer.concat([Buffer.from(ENCRYPTION_KEY), Buffer.alloc(32)], 32);

export const cryptoUtils = {
    encrypt(text: string): string {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY_BUFFER, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return `${iv.toString('hex')}:${encrypted}`;
    },

    decrypt(text: string): string {
        try {
            if (!text || !text.includes(':')) return text;
            const [ivHex, encryptedHex] = text.split(':');
            const iv = Buffer.from(ivHex, 'hex');
            const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY_BUFFER, iv);
            let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (e) {
            return text; // Return as-is if decryption fails
        }
    },

    decryptConfig(config: any): any {
        if (!config) return config;

        // Handle stringified JSON
        if (typeof config === 'string') {
            try {
                const parsed = JSON.parse(config);
                return this.decryptConfig(parsed);
            } catch (e) {
                return this.decrypt(config);
            }
        }

        const decrypted = Array.isArray(config) ? [] : {};
        for (const [key, value] of Object.entries(config)) {
            if (typeof value === 'string' && (
                key.toUpperCase().endsWith('_KEY') ||
                key.toUpperCase().endsWith('_TOKEN') ||
                key.toUpperCase() === 'TOKEN' ||
                key.toUpperCase().includes('SECRET') ||
                key.toUpperCase().includes('PASSWORD')
            )) {
                (decrypted as any)[key] = this.decrypt(value);
            } else if (typeof value === 'object' && value !== null) {
                (decrypted as any)[key] = this.decryptConfig(value);
            } else {
                (decrypted as any)[key] = value;
            }
        }
        return decrypted;
    }
};
