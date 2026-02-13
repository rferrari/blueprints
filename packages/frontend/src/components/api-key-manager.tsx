'use client';

import React, { useState } from 'react';
import { Key, Plus, Trash2, Copy, Check, Shield, AlertTriangle, Loader2 } from 'lucide-react';
import { useApiKeys } from '@/hooks/use-api-keys';
import { useNotification } from '@/components/notification-provider';

export default function ApiKeyManager() {
    const { keys, isLoading, generateKey, revokeKey } = useApiKeys();
    const { showNotification } = useNotification();

    const [isGenerating, setIsGenerating] = useState(false);
    const [newLabel, setNewLabel] = useState('');
    const [generatedKey, setGeneratedKey] = useState<{ key: string; id: string } | null>(null);

    const handleGenerate = async () => {
        if (!newLabel.trim()) return;
        setIsGenerating(true);
        try {
            const result = await generateKey(newLabel);
            setGeneratedKey(result);
            setNewLabel('');
            showNotification('API Key generated successfully', 'success');
        } catch (error) {
            showNotification('Failed to generate key', 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleRevoke = async (id: string) => {
        if (!confirm('Are you sure you want to revoke this key? API access using this key will stop immediately.')) return;
        try {
            await revokeKey(id);
            showNotification('API Key revoked', 'success');
        } catch (error) {
            showNotification('Failed to revoke key', 'error');
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        showNotification('Copied to clipboard', 'success');
    };

    return (
        <div className="glass-card rounded-[2.5rem] p-10 md:p-16 relative overflow-hidden mt-8">
            <div className="absolute top-0 right-0 p-12 opacity-5">
                <Shield size={120} />
            </div>

            <div className="relative z-10">
                <div className="mb-10 flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-black tracking-tight mb-2">MCP Access Keys</h2>
                        <p className="text-muted-foreground font-medium">Manage API keys for programmatic access to your agents via the Model Context Protocol.</p>
                    </div>
                </div>

                {/* GENERATED KEY DISPLAY */}
                {generatedKey && (
                    <div className="mb-10 p-6 bg-green-500/10 border border-green-500/20 rounded-2xl animate-in fade-in zoom-in duration-300">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-green-500/20 rounded-full text-green-400">
                                <Key size={24} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-green-400 mb-2">Key Generated Successfully</h3>
                                <p className="text-sm text-green-300/80 mb-4">
                                    Copy this key now. You will not be able to see it again!
                                </p>
                                <div className="flex items-center gap-2 bg-black/40 p-4 rounded-xl font-mono text-green-400 break-all border border-green-500/20">
                                    <span className="flex-1">{generatedKey.key}</span>
                                    <button
                                        onClick={() => copyToClipboard(generatedKey.key)}
                                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                        <Copy size={16} />
                                    </button>
                                </div>
                                <button
                                    onClick={() => setGeneratedKey(null)}
                                    className="mt-4 text-xs font-bold uppercase tracking-widest text-green-400 hover:text-green-300"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* GENERATE INPUT */}
                <div className="flex gap-4 mb-8 items-end">
                    <div className="flex-1 group">
                        <label className="block text-sm font-bold text-muted-foreground mb-3 ml-1 uppercase tracking-widest transition-colors group-focus-within:text-primary">
                            New Key Label
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={newLabel}
                                onChange={(e) => setNewLabel(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-6 outline-none focus:border-primary/50 focus:bg-white/[0.08] transition-all font-bold"
                                placeholder="e.g. Cursor IDE, CI/CD Pipeline"
                            />
                            <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={20} />
                        </div>
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={!newLabel.trim() || isGenerating}
                        className="h-[60px] px-8 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all flex items-center gap-3 shadow-xl shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                        Generate
                    </button>
                </div>

                {/* KEYS LIST */}
                <div className="space-y-4">
                    {isLoading ? (
                        <div className="text-center py-10 text-muted-foreground">Loading keys...</div>
                    ) : keys?.length === 0 ? (
                        <div className="text-center py-10 bg-white/5 rounded-2xl border border-dashed border-white/10">
                            <p className="text-muted-foreground font-medium">No API keys found. Generate one to get started.</p>
                        </div>
                    ) : (
                        keys?.map((key) => (
                            <div key={key.id} className={`p-6 rounded-2xl border transition-all flex items-center justify-between ${key.is_active ? 'bg-white/5 border-white/10' : 'bg-red-500/5 border-red-500/10 opacity-60'}`}>
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h4 className="font-bold text-lg">{key.label}</h4>
                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${key.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {key.is_active ? 'Active' : 'Revoked'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
                                        <span>Prefix: {key.prefix}</span>
                                        <span>•</span>
                                        <span>Created: {new Date(key.created_at).toLocaleDateString()}</span>
                                        {key.last_used_at && (
                                            <>
                                                <span>•</span>
                                                <span>Last used: {new Date(key.last_used_at).toLocaleDateString()}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {key.is_active && (
                                    <button
                                        onClick={() => handleRevoke(key.id)}
                                        className="p-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                                        title="Revoke Key"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
