'use client';

import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

export function useServiceStatus() {
    const [isDown, setIsDown] = useState(false);
    const [loading, setLoading] = useState(true);

    const checkHealth = async () => {
        try {
            // Normalize API_URL to remove trailing slashes
            const normalizedUrl = API_URL.replace(/\/+$/, '');
            const healthUrl = `${normalizedUrl}/health`;
            console.log(`[useServiceStatus] Checking health at: ${healthUrl}`);
            const res = await fetch(healthUrl, {
                method: 'GET',
                cache: 'no-store',
            });

            if (res.ok) {
                const contentType = res.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const data = await res.json();
                    setIsDown(data.status !== 'ok');
                } else {
                    const text = await res.text();
                    setIsDown(text.trim() !== 'ok');
                }
            } else {
                setIsDown(true);
            }
        } catch (err) {
            console.error('[useServiceStatus] Health check failed:', err);
            setIsDown(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkHealth();
        const interval = setInterval(checkHealth, HEALTH_CHECK_INTERVAL);
        return () => clearInterval(interval);
    }, []);

    return { isDown, loading };
}
