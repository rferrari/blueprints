'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bot, User, ArrowRight, Zap, List, Clock, Shield, Send } from 'lucide-react';
import Link from 'next/link';

interface Message {
    id: string;
    role: 'user' | 'agent';
    content: React.ReactNode;
    timestamp: Date;
}

export default function SupportChat() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [startedAt, setStartedAt] = useState<string | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const hasRun = useRef(false);

    const scrollToBottom = () => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    };

    useEffect(() => {
        // Small timeout to ensure DOM update
        const timeout = setTimeout(scrollToBottom, 100);
        return () => clearTimeout(timeout);
    }, [messages, isTyping]);

    useEffect(() => {
        if (hasRun.current) return;
        hasRun.current = true;

        setStartedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

        const runScenario = async () => {
            // Initial delay
            await new Promise(r => setTimeout(r, 600));

            // User Message
            setMessages([{
                id: '1',
                role: 'user',
                content: "I would like more information.",
                timestamp: new Date()
            }]);

            // Agent processing
            await new Promise(r => setTimeout(r, 1000));
            setIsTyping(true);

            // Agent Reply 1
            await new Promise(r => setTimeout(r, 1500));
            setIsTyping(false);
            setMessages(prev => [
                ...prev,
                {
                    id: '2',
                    role: 'agent',
                    content: "Here is the information you need:",
                    timestamp: new Date()
                }
            ]);

            // Agent processing
            await new Promise(r => setTimeout(r, 800));
            setIsTyping(true);

            // Agent Reply 2 (Rich)
            await new Promise(r => setTimeout(r, 2000));
            setIsTyping(false);
            setMessages(prev => [
                ...prev,
                {
                    id: '3',
                    role: 'agent',
                    content: (
                        <div className="space-y-6">
                            <p>Here is a comprehensive guide to getting started with your own autonomous cluster:</p>

                            <div className="grid gap-4">
                                <div className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 items-start hover:bg-white/10 transition-colors">
                                    <div className="size-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary mt-1 shrink-0">
                                        <Zap size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold mb-1">1. Create Your Agent</h4>
                                        <p className="text-sm text-muted-foreground">Select a blueprint from our marketplace or create a custom neural matrix from scratch.</p>
                                    </div>
                                </div>

                                <div className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 items-start hover:bg-white/10 transition-colors">
                                    <div className="size-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 mt-1 shrink-0">
                                        <Clock size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold mb-1">2. Up in Minutes</h4>
                                        <p className="text-sm text-muted-foreground">Our orchestration engine deploys your containers instantly. No devops required.</p>
                                    </div>
                                </div>

                                <div className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 items-start hover:bg-white/10 transition-colors">
                                    <div className="size-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 mt-1 shrink-0">
                                        <List size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold mb-1">3. Scale at Will</h4>
                                        <p className="text-sm text-muted-foreground">Deploy multiple agents, assign unique IDs, and have them collaborate in a swarm.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2">
                                <Link
                                    href="/signup"
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg active:scale-95"
                                >
                                    Start Building Now <ArrowRight size={16} />
                                </Link>
                            </div>
                        </div>
                    ),
                    timestamp: new Date()
                }
            ]);
        };

        runScenario();
    }, []);

    return (
        <div className="flex flex-col h-full overflow-hidden relative">
            {/* Chat Area */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar scroll-smooth">
                <div className="max-w-3xl mx-auto w-full space-y-6 pb-4">
                    <div className="text-center py-6">
                        <span className="px-4 py-1.5 bg-white/5 border border-white/5 rounded-full text-[10px] font-bold text-muted-foreground uppercase tracking-widest inline-block shadow-sm">
                            Session Started: {startedAt || 'Connecting...'}
                        </span>
                    </div>

                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-500`}
                        >
                            {msg.role === 'agent' && (
                                <div className="size-8 md:size-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center shrink-0 shadow-sm mt-1">
                                    <Bot size={18} className="text-primary" />
                                </div>
                            )}

                            <div className={`max-w-[85%] md:max-w-[70%] p-5 rounded-3xl shadow-md ${msg.role === 'user'
                                    ? 'bg-primary text-white rounded-tr-sm'
                                    : 'bg-white/5 text-white rounded-tl-sm border border-white/5 backdrop-blur-sm'
                                }`}>
                                <div className="text-sm font-medium leading-relaxed">
                                    {msg.content}
                                </div>
                                <div className={`text-[10px] uppercase tracking-widest font-bold mt-2 opacity-50 ${msg.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>

                            {msg.role === 'user' && (
                                <div className="size-8 md:size-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center shrink-0 shadow-sm mt-1">
                                    <User size={18} className="text-white" />
                                </div>
                            )}
                        </div>
                    ))}

                    {isTyping && (
                        <div className="flex gap-4 justify-start animate-in fade-in duration-300">
                            <div className="size-8 md:size-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center shrink-0 shadow-sm mt-1">
                                <Bot size={18} className="text-primary" />
                            </div>
                            <div className="bg-white/5 p-4 rounded-3xl rounded-tl-sm border border-white/5 flex items-center gap-1.5 h-[46px] shadow-sm">
                                <span className="size-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="size-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="size-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Input Placeholder */}
            <div className="p-4 md:p-6 z-40 bg-background/50 backdrop-blur-md border-t border-white/5 shrink-0">
                <div className="max-w-3xl mx-auto">
                    <div className="relative group opacity-80 hover:opacity-100 transition-opacity">
                        <input
                            type="text"
                            disabled
                            placeholder="Chat session paused. Sign in to continue conversation."
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-6 pr-14 text-sm font-medium text-muted-foreground cursor-not-allowed focus:outline-none shadow-inner"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-white/5 text-muted-foreground">
                            <Send size={18} />
                        </div>
                    </div>
                    <div className="text-center mt-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest flex items-center justify-center gap-2">
                            <Shield size={10} />
                            Neural Link Secure • Powered by <span className="text-white font-bold">OpenClaw</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
