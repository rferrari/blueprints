'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { Key, Shield, Clock, Trash2, Plus, RefreshCw, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, X, Save, AlertCircle, Copy, Check } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface ManagedKey {
    id: string;
    provider: string;
    label: string;
    active: boolean;
    config: any;
    daily_limit_usd?: number;
    monthly_limit_usd?: number;
    created_at: string;
    active_leases?: number;
}

interface KeyLease {
    id: string;
    managed_key_id: string;
    user_id: string;
    granted_at: string;
    expires_at: string;
    revoked_at?: string;
    status: string;
    usage_usd: number;
    last_used_at?: string;
    max_agents: number;
    profiles?: { email: string };
}

export default function ManagedKeysAdmin() {
    const supabase = createClient();
    const [tab, setTab] = useState<'keys' | 'leases'>('keys');
    const [keys, setKeys] = useState<ManagedKey[]>([]);
    const [leases, setLeases] = useState<KeyLease[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedKey, setExpandedKey] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [token, setToken] = useState<string | null>(null);

    // New key form state
    const [newKey, setNewKey] = useState({
        provider: 'openrouter',
        label: '',
        api_key: '',
        default_model: 'openrouter/auto',
        base_url: 'https://openrouter.ai/api/v1',
        daily_limit_usd: '',
        monthly_limit_usd: '',
    });

    useEffect(() => {
        const getToken = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setToken(session?.access_token || null);
        };
        getToken();
    }, []);

    useEffect(() => {
        if (token) fetchKeys();
    }, [token]);

    const fetchKeys = async () => {
        if (!token) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_URL}/admin/managed-keys`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch managed keys');
            setKeys(await res.json());
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchLeases = async (keyId: string) => {
        if (!token) return;
        try {
            const res = await fetch(`${API_URL}/admin/managed-keys/${keyId}/leases`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch leases');
            setLeases(await res.json());
        } catch (err: any) {
            setError(err.message);
        }
    };

    const createKey = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/admin/managed-keys`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    provider: newKey.provider,
                    label: newKey.label,
                    api_key: newKey.api_key,
                    config: {
                        default_model: newKey.default_model,
                        base_url: newKey.base_url,
                    },
                    daily_limit_usd: newKey.daily_limit_usd ? parseFloat(newKey.daily_limit_usd) : undefined,
                    monthly_limit_usd: newKey.monthly_limit_usd ? parseFloat(newKey.monthly_limit_usd) : undefined,
                })
            });
            if (!res.ok) throw new Error('Failed to create managed key');
            setShowAddForm(false);
            setNewKey({ provider: 'openrouter', label: '', api_key: '', default_model: 'openrouter/auto', base_url: 'https://openrouter.ai/api/v1', daily_limit_usd: '', monthly_limit_usd: '' });
            await fetchKeys();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleKeyActive = async (keyId: string, active: boolean) => {
        if (!token) return;
        try {
            await fetch(`${API_URL}/admin/managed-keys/${keyId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ active: !active })
            });
            await fetchKeys();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const revokeLease = async (leaseId: string) => {
        if (!token) return;
        try {
            await fetch(`${API_URL}/admin/managed-keys/leases/${leaseId}/revoke`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (expandedKey) await fetchLeases(expandedKey);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const extendLease = async (leaseId: string, days: number) => {
        if (!token) return;
        try {
            await fetch(`${API_URL}/admin/managed-keys/leases/${leaseId}/extend`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ additional_days: days })
            });
            if (expandedKey) await fetchLeases(expandedKey);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const toggleExpand = async (keyId: string) => {
        if (expandedKey === keyId) {
            setExpandedKey(null);
            setLeases([]);
        } else {
            setExpandedKey(keyId);
            await fetchLeases(keyId);
        }
    };

    const timeAgo = (dateStr: string) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days > 0) return `${days}d ago`;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        if (hours > 0) return `${hours}h ago`;
        return 'just now';
    };

    const timeUntil = (dateStr: string) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diff = d.getTime() - now.getTime();
        if (diff <= 0) return 'expired';
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days > 0) return `${days}d`;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        return `${hours}h`;
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Key className="w-5 h-5 text-amber-400" />
                    <h2 className="text-lg font-semibold text-white">Managed Provider Keys</h2>
                </div>
                <div className="flex gap-2">
                    <button onClick={fetchKeys} className="p-2 text-gray-400 hover:text-white transition-colors" title="Refresh">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/20 text-amber-300 rounded-lg hover:bg-amber-500/30 transition-colors text-sm"
                    >
                        <Plus className="w-4 h-4" /> Add Key
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/20 rounded-lg text-red-300 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                    <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* Add Key Form */}
            {showAddForm && (
                <div className="p-4 bg-gray-800/60 rounded-lg border border-gray-700 space-y-3">
                    <h3 className="text-sm font-medium text-white">Add Managed Key</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-gray-400">Label</label>
                            <input
                                type="text"
                                value={newKey.label}
                                onChange={(e) => setNewKey(prev => ({ ...prev, label: e.target.value }))}
                                className="w-full mt-1 px-3 py-2 bg-gray-900/60 border border-gray-700 rounded text-sm text-white"
                                placeholder="Production OpenRouter Key"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400">Provider</label>
                            <input
                                type="text"
                                value={newKey.provider}
                                onChange={(e) => setNewKey(prev => ({ ...prev, provider: e.target.value }))}
                                className="w-full mt-1 px-3 py-2 bg-gray-900/60 border border-gray-700 rounded text-sm text-white"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-gray-400">API Key</label>
                        <input
                            type="password"
                            value={newKey.api_key}
                            onChange={(e) => setNewKey(prev => ({ ...prev, api_key: e.target.value }))}
                            className="w-full mt-1 px-3 py-2 bg-gray-900/60 border border-gray-700 rounded text-sm text-white"
                            placeholder="sk-..."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-gray-400">Default Model</label>
                            <input
                                type="text"
                                value={newKey.default_model}
                                onChange={(e) => setNewKey(prev => ({ ...prev, default_model: e.target.value }))}
                                className="w-full mt-1 px-3 py-2 bg-gray-900/60 border border-gray-700 rounded text-sm text-white"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400">Base URL</label>
                            <input
                                type="text"
                                value={newKey.base_url}
                                onChange={(e) => setNewKey(prev => ({ ...prev, base_url: e.target.value }))}
                                className="w-full mt-1 px-3 py-2 bg-gray-900/60 border border-gray-700 rounded text-sm text-white"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-gray-400">Daily Limit (USD) (TBD - not implemented)</label>
                            <input
                                type="number"
                                value={newKey.daily_limit_usd}
                                onChange={(e) => setNewKey(prev => ({ ...prev, daily_limit_usd: e.target.value }))}
                                className="w-full mt-1 px-3 py-2 bg-gray-900/60 border border-gray-700 rounded text-sm text-white"
                                placeholder="Optional"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400">Monthly Limit (USD) (TBD - not implemented)</label>
                            <input
                                type="number"
                                value={newKey.monthly_limit_usd}
                                onChange={(e) => setNewKey(prev => ({ ...prev, monthly_limit_usd: e.target.value }))}
                                className="w-full mt-1 px-3 py-2 bg-gray-900/60 border border-gray-700 rounded text-sm text-white"
                                placeholder="Optional"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowAddForm(false)} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white">Cancel</button>
                        <button
                            onClick={createKey}
                            disabled={!newKey.label || !newKey.api_key || loading}
                            className="flex items-center gap-1 px-4 py-1.5 bg-amber-500 text-black rounded text-sm font-medium hover:bg-amber-400 disabled:opacity-50"
                        >
                            <Save className="w-3.5 h-3.5" /> Create
                        </button>
                    </div>
                </div>
            )}

            {/* Keys List */}
            <div className="space-y-2">
                {keys.length === 0 && !loading && (
                    <div className="text-center py-8 text-gray-500 text-sm">
                        No managed keys configured. Add one to get started.
                    </div>
                )}

                {keys.map((key) => (
                    <div key={key.id} className="bg-gray-800/40 rounded-lg border border-gray-700/50 overflow-hidden">
                        {/* Key Header */}
                        <div
                            className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-700/30 transition-colors"
                            onClick={() => toggleExpand(key.id)}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${key.active ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                                <div>
                                    <span className="text-sm font-medium text-white">{key.label}</span>
                                    <span className="ml-2 text-xs text-gray-500">{key.provider}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-400">{key.active_leases || 0} active leases</span>
                                {key.config?.default_model && (
                                    <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded">
                                        {key.config.default_model}
                                    </span>
                                )}
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleKeyActive(key.id, key.active); }}
                                    className={`p-1 rounded transition-colors ${key.active ? 'text-emerald-400 hover:text-emerald-300' : 'text-gray-500 hover:text-gray-400'}`}
                                    title={key.active ? 'Disable' : 'Enable'}
                                >
                                    {key.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                                </button>
                                {expandedKey === key.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                            </div>
                        </div>

                        {/* Expanded: Leases */}
                        {expandedKey === key.id && (
                            <div className="border-t border-gray-700/50 p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Leases</span>
                                    <span className="text-xs text-gray-500">Created {timeAgo(key.created_at)}</span>
                                </div>

                                {leases.length === 0 ? (
                                    <div className="text-center py-4 text-gray-500 text-xs">No leases</div>
                                ) : (
                                    <div className="space-y-1">
                                        {leases.map((lease) => (
                                            <div key={lease.id} className="flex items-center justify-between p-2 bg-gray-900/40 rounded text-xs">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${lease.status === 'active' ? 'bg-emerald-400' :
                                                        lease.status === 'expired' ? 'bg-yellow-400' : 'bg-red-400'
                                                        }`} />
                                                    <span className="text-gray-300 font-mono">
                                                        {lease.profiles?.email || lease.user_id.slice(0, 8)}
                                                    </span>
                                                    <span className="text-gray-500">
                                                        <Clock className="w-3 h-3 inline mr-1" />
                                                        {lease.status === 'active' ? timeUntil(lease.expires_at) : lease.status}
                                                    </span>
                                                    {lease.usage_usd > 0 && (
                                                        <span className="text-amber-300">${lease.usage_usd.toFixed(2)}</span>
                                                    )}
                                                </div>
                                                <div className="flex gap-1">
                                                    {lease.status === 'active' && (
                                                        <>
                                                            <button
                                                                onClick={() => extendLease(lease.id, 7)}
                                                                className="px-2 py-0.5 text-blue-300 hover:bg-blue-500/20 rounded transition-colors"
                                                                title="Extend 7 days"
                                                            >
                                                                +7d
                                                            </button>
                                                            <button
                                                                onClick={() => revokeLease(lease.id)}
                                                                className="px-2 py-0.5 text-red-300 hover:bg-red-500/20 rounded transition-colors"
                                                                title="Revoke"
                                                            >
                                                                Revoke
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
