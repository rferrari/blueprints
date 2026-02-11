import crypto from 'node:crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-32-chars-long-12345'; // fallback for dev
const ENCRYPTION_KEY_BUFFER = Buffer.concat([Buffer.from(ENCRYPTION_KEY), Buffer.alloc(32)], 32);
const ENCRYPT_MODE = (process.env.ENCRYPT_MODE || 'sensitive') as 'sensitive' | 'all' | 'none';

export const cryptoUtils = {
    /**
     * Encrypts a string using AES-256-CBC
     * @param text - Plain text to encrypt
     * @returns Encrypted string in format: {iv_hex}:{encrypted_hex}
     */
    encrypt(text: string): string {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY_BUFFER, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return `${iv.toString('hex')}:${encrypted}`;
    },

    /**
     * Decrypts a string encrypted with encrypt()
     * @param text - Encrypted string in format: {iv_hex}:{encrypted_hex}
     * @returns Decrypted plain text, or original text if decryption fails
     */
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

    /**
     * Checks if a key name indicates sensitive data
     * @param key - Object key name to check
     * @returns true if key indicates sensitive data
     */
    isSensitiveKey(key: string): boolean {
        const k = key.toUpperCase();

        const strongSignals = [
            'SECRET',
            'PASSWORD',
            'PASSWD',
            'PRIVATE_KEY',
            'ACCESS_TOKEN',
            'REFRESH_TOKEN',
            'SERVICE_ROLE',
            'BEARER',
            'JWT',
        ];

        const weakSignals = [
            '_KEY',
            '_TOKEN',
            'API_KEY',
            'CLIENT_SECRET',
            'AUTH',
        ];

        if (strongSignals.some(s => k.includes(s))) return true;

        if (weakSignals.some(s => k.includes(s))) return true;

        // Exact matches
        if (['TOKEN', 'APIKEY', 'API_KEY'].includes(k)) return true;

        return false;
    },

    /**
     * Recursively decrypts sensitive fields in a config object
     * @param config - Config object to decrypt
     * @returns Decrypted config object
     */
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
            if (typeof value === 'string' && this.isSensitiveKey(key)) {
                (decrypted as any)[key] = this.decrypt(value);
            } else if (typeof value === 'object' && value !== null) {
                (decrypted as any)[key] = this.decryptConfig(value);
            } else {
                (decrypted as any)[key] = value;
            }
        }
        return decrypted;
    },

    /**
     * Checks if a string appears to be encrypted (format: 32-char-hex-IV:hex-ciphertext)
     * @param text - String to check
     * @returns true if string matches encryption format
     */
    isEncrypted(text: string): boolean {
        if (!text || typeof text !== 'string' || !text.includes(':')) return false;
        const parts = text.split(':');
        if (parts.length !== 2) return false;
        const [ivHex, encryptedHex] = parts;

        // IV must be 16 bytes (32 hex chars)
        if (ivHex.length !== 32) return false;

        // Check if both parts are valid hex
        const hexRegex = /^[0-9a-f]+$/i;
        return hexRegex.test(ivHex) && hexRegex.test(encryptedHex);
    },

    /**
     * Recursively encrypts sensitive fields in a config object
     * Respects ENCRYPT_MODE environment variable:
     * - 'sensitive' (default): Only encrypt keys matching isSensitiveKey()
     * - 'all': Encrypt all string values
     * - 'none': No encryption (for debugging)
     * 
     * Skips encryption if the value is already encrypted (matches isEncrypted format)
     * 
     * @param config - Config object to encrypt
     * @returns Encrypted config object
     */
    encryptConfig(config: any): any {
        if (!config) return config;
        if (ENCRYPT_MODE === 'none') return config;

        const encrypted = Array.isArray(config) ? [] : {};
        for (const [key, value] of Object.entries(config)) {
            const shouldEncrypt = ENCRYPT_MODE === 'all'
                ? typeof value === 'string'
                : (typeof value === 'string' && this.isSensitiveKey(key));

            if (shouldEncrypt) {
                // Check if already encrypted to verify idempotency
                if (this.isEncrypted(value as string)) {
                    (encrypted as any)[key] = value;
                } else {
                    (encrypted as any)[key] = this.encrypt(value as string);
                }
            } else if (typeof value === 'object' && value !== null) {
                (encrypted as any)[key] = this.encryptConfig(value);
            } else {
                (encrypted as any)[key] = value;
            }
        }
        return encrypted;
    }
};
