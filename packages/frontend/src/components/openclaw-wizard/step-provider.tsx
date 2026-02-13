'use client';

import React from 'react';
import { Bot, Zap, Cpu, Share2, Terminal, Check } from 'lucide-react';
import { OpenClawConfig } from './types';

interface StepProviderProps {
    name: string;
    config: OpenClawConfig;
    setConfig: (updater: (prev: OpenClawConfig) => OpenClawConfig) => void;
    mkEnabled?: boolean;
}

export function StepProvider({ name, config, setConfig, mkEnabled }: StepProviderProps) {
    const providers = [
        { id: 'venice', name: 'Venice AI', desc: 'Uncensored & Private', Icon: Cpu, color: 'text-purple-400' },
        { id: 'anthropic', name: 'Anthropic', desc: 'Reasoning & Coding', Icon: Bot, color: 'text-orange-500' },
        { id: 'openai', name: 'OpenAI GPT', desc: 'Versatile & Reliable', Icon: Zap, color: 'text-green-500' },
        ...(mkEnabled ? [{ id: 'blueprint_shared', name: 'Blueprint Shared', desc: 'Strategic Partner Key', Icon: Share2, color: 'text-blue-400' }] : []),
        { id: 'groq', name: 'Groq', desc: 'Ultra-fast LPU', Icon: Zap, color: 'text-orange-400' },
        { id: 'deepseek', name: 'DeepSeek', desc: 'Advanced Reasoning', Icon: Cpu, color: 'text-blue-500' },
        { id: 'mistral', name: 'Mistral IT', desc: 'Efficient Open Models', Icon: Bot, color: 'text-blue-300' },
        { id: 'ollama', name: 'Local (Ollama)', desc: 'Run locally on host', Icon: Terminal, color: 'text-slate-400' },
    ];

    return (
        <div className="space-y-6">
            <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                Choose the primary intelligence source for **{name}**.
            </p>
            <div className="flex overflow-x-auto gap-4 pb-6 pt-2 snap-x custom-scrollbar">
                {providers.map(p => (
                    <button
                        key={p.id}
                        onClick={() => setConfig((prev) => ({ ...prev, provider: p.id }))}
                        className={`shrink-0 w-48 p-6 rounded-[2.5rem] border text-center transition-all flex flex-col items-center gap-4 snap-center relative ${config.provider === p.id ? 'border-primary bg-primary/10 ring-4 ring-primary/10' : 'border-white/5 bg-white/5 hover:border-white/10 hover:bg-white/[0.08]'}`}
                    >
                        <div className={`size-16 rounded-3xl bg-white/5 flex items-center justify-center shrink-0 transition-transform ${config.provider === p.id ? 'scale-110' : ''}`}>
                            <p.Icon className={p.color} size={32} />
                        </div>
                        <div>
                            <h4 className="font-black text-xs uppercase tracking-widest mb-1 truncate w-full">{p.name}</h4>
                            <p className="text-[10px] text-muted-foreground font-medium line-clamp-2">{p.desc}</p>
                        </div>
                        {config.provider === p.id && (
                            <div className="absolute top-4 right-4 size-6 rounded-full bg-primary flex items-center justify-center text-white scale-in-center">
                                <Check size={14} />
                            </div>
                        )}
                    </button>
                ))}
            </div>
            <div className="flex justify-center gap-1.5">
                <div className="h-1 w-8 rounded-full bg-primary/20 overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-300" style={{ width: '40%' }} />
                </div>
                <div className="h-1 w-1 rounded-full bg-white/10" />
                <div className="h-1 w-1 rounded-full bg-white/10" />
            </div>
        </div>
    );
}
