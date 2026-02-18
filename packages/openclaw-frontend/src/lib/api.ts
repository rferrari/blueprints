import { createClient } from './supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function getAuthHeaders(): Promise<Record<string, string>> {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Not authenticated');
    return {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
    };
}

export async function apiFetch<T = unknown>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            ...headers,
            ...(options.headers || {}),
        },
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `API error: ${res.status}`);
    }

    return res.json();
}

export async function apiPost<T = unknown>(
    path: string,
    body: unknown
): Promise<T> {
    return apiFetch<T>(path, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export async function apiPatch<T = unknown>(
    path: string,
    body: unknown
): Promise<T> {
    return apiFetch<T>(path, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
}
