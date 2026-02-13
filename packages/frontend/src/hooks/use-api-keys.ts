import useSWR from 'swr';
import { useAuth } from '@/components/auth-provider';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface ApiKey {
    id: string;
    label: string;
    prefix: string;
    scopes: string[];
    created_at: string;
    last_used_at: string | null;
    is_active: boolean;
}

export function useApiKeys() {
    const { session } = useAuth();
    const token = session?.access_token;

    const fetcher = async (url: string) => {
        if (!token) return [];
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch keys');
        return res.json();
    };

    const { data, error, mutate } = useSWR<ApiKey[]>(
        token ? `${API_URL}/api-keys` : null,
        fetcher
    );

    const generateKey = async (label: string, scopes: string[] = []) => {
        if (!token) throw new Error('Not authenticated');
        const res = await fetch(`${API_URL}/api-keys`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ label, scopes })
        });
        if (!res.ok) throw new Error('Failed to generate key');
        await mutate();
        return res.json() as Promise<{ key: string; id: string }>;
    };

    const revokeKey = async (id: string) => {
        if (!token) throw new Error('Not authenticated');
        const res = await fetch(`${API_URL}/api-keys/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to revoke key');
        await mutate();
    };

    return {
        keys: data,
        isLoading: !error && !data,
        isError: error,
        generateKey,
        revokeKey
    };
}
