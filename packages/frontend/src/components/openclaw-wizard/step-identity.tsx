'use client';

import React, { useState } from 'react';
import { User, Terminal, Activity } from 'lucide-react';
import { OpenClawConfig } from './types';

interface StepIdentityProps {
    avatar: string;
    setAvatar: (avatar: string) => void;
    name: string;
    setName: (name: string) => void;
    setConfig: (updater: (prev: OpenClawConfig) => OpenClawConfig) => void;
    setJsonMode: (mode: boolean) => void;
    jsonMode: boolean;
}

export function StepIdentity({
    avatar,
    setAvatar,
    name,
    setName,
    setConfig,
    setJsonMode,
    jsonMode
}: StepIdentityProps) {
    const [pastedJson, setPastedJson] = useState('');

    const handleImportJson = () => {
        try {
            const parsed = JSON.parse(pastedJson);
            // Derive config from parsed JSON
            setConfig((prev: OpenClawConfig) => ({ ...prev, ...parsed }));
            setJsonMode(false); // Switch back to wizard populated with JSON data
            // If the JSON had model info, etc, it will be reflected in later steps
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Invalid JSON';
            alert('Invalid JSON: ' + message);
        }
    };

    return (
        <div className="space-y-8">
            {!jsonMode ? (
                <>
                    <div className="space-y-6">
                        <div className="flex flex-col gap-6 items-center">
                            <div className="size-32 rounded-3xl bg-white/5 border-4 border-white/10 overflow-hidden relative group/avatar shadow-2xl">
                                {avatar ? (
                                    <img src={avatar} className="w-full h-full object-cover" alt="Agent Avatar" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white/10 bg-gradient-to-br from-white/5 to-transparent">
                                        <User size={48} />
                                    </div>
                                )}
                            </div>
                            <div className="w-full space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-primary">Identity Callsign</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 font-bold text-lg focus:border-primary outline-none transition-all placeholder:text-white/10"
                                        placeholder="Ghost in the Shell..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Avatar Visualization (URL)</label>
                                    <input
                                        type="text"
                                        value={avatar}
                                        onChange={(e) => setAvatar(e.target.value)}
                                        className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-sm focus:border-primary outline-none transition-all placeholder:text-white/10"
                                        placeholder="https://images.unsplash.com/photo..."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative py-4">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                        <div className="relative flex justify-center text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/30"><span className="bg-slate-950 px-4">OR</span></div>
                    </div>

                    <button
                        onClick={() => setJsonMode(true)}
                        className="w-full p-6 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-all flex items-center justify-center gap-4 group"
                    >
                        <Terminal size={20} className="text-muted-foreground group-hover:text-primary transition-colors" />
                        <div className="text-left">
                            <h4 className="font-black text-[10px] uppercase tracking-widest text-muted-foreground group-hover:text-white transition-colors">Direct Matrix Injection</h4>
                            <p className="text-[10px] text-muted-foreground/40 font-medium italic">Paste raw OpenClaw JSON configuration</p>
                        </div>
                    </button>
                </>
            ) : (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary">Neural Matrix JSON</label>
                        <button onClick={() => setJsonMode(false)} className="text-[10px] font-black uppercase text-muted-foreground hover:text-white">Back to Wizard</button>
                    </div>
                    <textarea
                        value={pastedJson}
                        onChange={(e) => setPastedJson(e.target.value)}
                        rows={12}
                        className="w-full bg-black/40 border border-white/10 rounded-3xl p-6 font-mono text-[10px] focus:border-primary outline-none transition-all custom-scrollbar h-[350px]"
                        placeholder={`{
"auth": { ... },
"gateway": { ... },
"channels": { ... }
}`}
                    />
                    <button
                        onClick={handleImportJson}
                        disabled={!pastedJson}
                        className="w-full py-4 rounded-2xl bg-primary text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-xl shadow-primary/20"
                    >
                        <Activity size={16} /> Synchronize Neural Matrix
                    </button>
                </div>
            )}
        </div>
    );
}

// Helper to check standard OpenClaw Config object structure
export function getOne<T>(val: T | T[]): T {
    return Array.isArray(val) ? val[0] : val;
}
