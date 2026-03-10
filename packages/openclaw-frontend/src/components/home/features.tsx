'use client';

import React from 'react';
import { Globe, Code, MessageCircle, Terminal, Layers, Cpu } from 'lucide-react';

const features = [
    {
        icon: MessageCircle,
        title: 'Multi-Channel Chat',
        description: 'Connect to WhatsApp, Telegram, Discord, and Slack seamlessly.'
    },
    {
        icon: Globe,
        title: 'Web Browsing',
        description: 'Extract data, search info, and compile reports autonomously.'
    },
    {
        icon: Code,
        title: 'Code Execution',
        description: 'Run scripts, manage GitHub, and automate your CI/CD pipelines.'
    },
    {
        icon: Terminal,
        title: 'Direct Terminal',
        description: 'Command-line power directly in your browser for total control.'
    },
    {
        icon: Layers,
        title: '50+ Integrations',
        description: 'Spotify, cloud storage, smart devices, and more ready to go.'
    },
    {
        icon: Cpu,
        title: 'Model Freedom',
        description: 'Use Claude, GPT, Gemini, or host your own local AI models.'
    }
];

export function Features() {
    return (
        <section className="py-24 bg-white/[0.02]">
            <div className="max-w-7xl mx-auto px-6">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-black tracking-tighter mb-4 italic uppercase">
                        Unmatched Capabilities
                    </h2>
                    <p className="text-muted-foreground font-medium max-w-xl mx-auto">
                        Everything you need to build, deploy, and manage your autonomous AI assistant.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {features.map((feature, i) => (
                        <div
                            key={i}
                            className="p-8 rounded-3xl glass-card group"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <feature.icon className="text-primary" size={24} />
                            </div>
                            <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
