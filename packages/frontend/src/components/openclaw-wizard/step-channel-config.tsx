'use client';

import React from 'react';
import { Send, Hash, MessageCircle, Slack } from 'lucide-react';
import { OpenClawConfig } from './types';

interface StepChannelConfigProps {
    config: OpenClawConfig;
    setConfig: (updater: (prev: OpenClawConfig) => OpenClawConfig) => void;
    existingConfig: any;
}

export function StepChannelConfig({ config, setConfig, existingConfig }: StepChannelConfigProps) {
    if (!config.channels.telegram && !config.channels.discord && !config.channels.whatsapp && !config.channels.slack) {
        return (
            <div className="h-[200px] flex flex-col items-center justify-center text-center p-6 bg-white/5 rounded-3xl border border-dashed border-white/10">
                <p className="text-[10px] font-medium text-muted-foreground italic">No channels selected. Your agent will only be available via the Blueprints internal chat.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {config.channels.telegram && (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                            <Send size={18} />
                        </div>
                        <h4 className="font-black text-xs uppercase tracking-widest">Telegram Configuration</h4>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bot Token</label>
                        <input
                            type="password"
                            value={config.telegramToken}
                            onChange={(e) => setConfig((prev) => ({ ...prev, telegramToken: e.target.value }))}
                            className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-sm focus:border-primary outline-none transition-all placeholder:text-white/10"
                            placeholder={existingConfig.channels?.telegram?.botToken ? "Leave blank to keep same token..." : "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"}
                        />
                    </div>
                </div>
            )}

            {config.channels.discord && (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-300 delay-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                            <Hash size={18} />
                        </div>
                        <h4 className="font-black text-xs uppercase tracking-widest">Discord Configuration</h4>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bot Token</label>
                        <input
                            type="password"
                            value={config.discordToken}
                            onChange={(e) => setConfig((prev) => ({ ...prev, discordToken: e.target.value }))}
                            className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-sm focus:border-primary outline-none transition-all placeholder:text-white/10"
                            placeholder={existingConfig.channels?.discord?.token ? "Leave blank to keep same token..." : "MTAw..."}
                        />
                    </div>
                </div>
            )}

            {config.channels.whatsapp && (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-300 delay-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-green-500/10 text-green-400">
                            <MessageCircle size={18} />
                        </div>
                        <h4 className="font-black text-xs uppercase tracking-widest">WhatsApp Configuration</h4>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Access Token</label>
                        <input
                            type="password"
                            value={config.whatsappToken}
                            onChange={(e) => setConfig((prev) => ({ ...prev, whatsappToken: e.target.value }))}
                            className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-sm focus:border-primary outline-none transition-all placeholder:text-white/10"
                            placeholder={existingConfig.channels?.whatsapp?.token ? "Leave blank to keep same token..." : "EAAG..."}
                        />
                    </div>
                </div>
            )}

            {config.channels.slack && (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-300 delay-300">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                            <Slack size={18} />
                        </div>
                        <h4 className="font-black text-xs uppercase tracking-widest">Slack Configuration</h4>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bot User OAuth Token</label>
                        <input
                            type="password"
                            value={config.slackToken}
                            onChange={(e) => setConfig((prev) => ({ ...prev, slackToken: e.target.value }))}
                            className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-sm focus:border-primary outline-none transition-all placeholder:text-white/10"
                            placeholder={existingConfig.channels?.slack?.token ? "Leave blank to keep same token..." : "xoxb-..."}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
