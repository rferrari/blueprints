'use client';

import React from 'react';
import { Send, Hash, MessageCircle, Slack, Check } from 'lucide-react';
import { OpenClawConfig } from './types';

interface StepChannelsProps {
    name: string;
    config: OpenClawConfig;
    setConfig: (updater: (prev: OpenClawConfig) => OpenClawConfig) => void;
}

export function StepChannels({ name, config, setConfig }: StepChannelsProps) {
    return (
        <div className="space-y-8">
            <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                Select which communication channels <strong>{name}</strong> should be available on.
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                    { id: 'telegram', name: 'Telegram', icon: <Send size={20} className="text-blue-400" /> },
                    { id: 'discord', name: 'Discord', icon: <Hash size={20} className="text-indigo-400" /> },
                    { id: 'whatsapp', name: 'WhatsApp', icon: <MessageCircle size={20} className="text-green-400" /> },
                    { id: 'slack', name: 'Slack', icon: <Slack size={20} className="text-amber-400" /> },
                ].map(c => (
                    <button
                        key={c.id}
                        onClick={() => {
                            setConfig((prev) => ({
                                ...prev,
                                channels: { ...prev.channels, [c.id]: !prev.channels[c.id] }
                            }));
                        }}
                        className={`p-6 rounded-2xl border transition-all flex flex-col items-center gap-4 text-center ${config.channels[c.id]
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-white/5 bg-white/5 hover:bg-white/10 text-muted-foreground'
                            }`}
                    >
                        <div className="size-10 rounded-xl bg-white/10 flex items-center justify-center">
                            {c.icon}
                        </div>
                        <span className="font-bold text-xs uppercase tracking-widest">{c.name}</span>
                        {config.channels[c.id] && (
                            <div className="absolute top-4 right-4 text-primary">
                                <Check size={14} />
                            </div>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}
