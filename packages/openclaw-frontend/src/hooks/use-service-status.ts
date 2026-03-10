'use client';

import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

export function useServiceStatus() {
    const [isDown, setIsDown] = useState(false);
    const [loading, setLoading] = useState(true);

    const checkHealth = async () => {
        try {
            const res = await fetch(`${API_URL}/health`, {
                method: 'GET',
                cache: 'no-store',
            });

            if (res.ok) {
                const data = await res.json();
                setIsDown(data.status !== 'ok');
            } else {
                setIsDown(true);
            }
        } catch (err) {
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
