'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, User, Shield, Send, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase';

interface Message {
    id: string;
    role: 'user' | 'agent' | 'system';
    content: React.ReactNode;
    timestamp: Date;
    sequence: number;
}

export default function SupportChat() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isTyping] = useState(false);
    const [inputText, setInputText] = useState('');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [, setError] = useState<string | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const supabase = createClient();
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    const scrollToBottom = useCallback(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, []);

    useEffect(() => {
        const timeout = setTimeout(scrollToBottom, 100);
        return () => clearTimeout(timeout);
    }, [messages, isTyping, scrollToBottom]);

    const fetchHistory = useCallback(async (id: string) => {
        try {
            const res = await fetch(`${API_URL}/support/history/${id}`);
            if (res.ok) {
                const data = await res.json();
                const mapped = data.map((m: { id: string; content: string; sender: 'user' | 'agent' | 'system'; created_at: string; sequence: number }) => ({
                    id: m.id,
                    role: m.sender,
                    content: m.content,
                    timestamp: new Date(m.created_at),
                    sequence: m.sequence
                }));
                // Only update if changes found to avoid jitter
                if (JSON.stringify(mapped) !== JSON.stringify(messages)) {
                    setMessages(mapped);
                }
            }
        } catch (err) {
            console.error('Polling failed:', err);
        }
    }, [API_URL, messages]);

    // 1. Session Initialization
    useEffect(() => {
        const initSession = async () => {
            try {
                let savedId = sessionStorage.getItem('support_session_id');

                if (!savedId) {
                    const res = await fetch(`${API_URL}/support/session`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_agent: navigator.userAgent })
                    });
                    if (!res.ok) throw new Error('Failed to initialize session');
                    const { sessionId: newSessionId } = await res.json();
                    savedId = newSessionId;
                    sessionStorage.setItem('support_session_id', savedId as string);
                }

                setSessionId(savedId);
                await fetchHistory(savedId as string);
            } catch (err: unknown) {
                console.error(err);
                setError('Neural link synchronization failed. Please refresh.');
            } finally {
                setIsConnecting(false);
            }
        };

        initSession();
    }, [API_URL, fetchHistory]);

    // 2. Polling
    useEffect(() => {
        if (!sessionId) return;
        const interval = setInterval(() => fetchHistory(sessionId), 3000);
        return () => clearInterval(interval);
    }, [sessionId, fetchHistory]);

    // 3. Send Message
    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputText.trim() || !sessionId || isSending) return;

        const content = inputText;
        setInputText('');
        setIsSending(true);

        const nextSequence = messages.length > 0 ? Math.max(...messages.map(m => m.sequence)) + 1 : 1;

        try {
            const res = await fetch(`${API_URL}/support/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    content,
                    sequence: nextSequence
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || 'Transmission failed');
            }

            await fetchHistory(sessionId);
        } catch (err: unknown) {
            console.error(err);
        } finally {
            setIsSending(false);
        }
    };

    if (isConnecting) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                <Loader2 className="animate-spin text-primary" size={32} />
                <p className="text-xs font-black uppercase tracking-widest animate-pulse">Establishing Secure Neural Link...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden relative">
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar scroll-smooth">
                <div className="max-w-3xl mx-auto w-full space-y-6 pb-4">
                    <div className="text-center py-6">
                        <span className="px-4 py-1.5 bg-white/5 border border-white/5 rounded-full text-[10px] font-bold text-muted-foreground uppercase tracking-widest inline-block shadow-sm">
                            Session Active • {sessionId?.slice(0, 8)}
                        </span>
                    </div>

                    {messages.length === 0 && (
                        <div className="text-center py-12 space-y-4 animate-in fade-in duration-1000">
                            <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 border border-primary/20">
                                <Bot size={32} className="text-primary" />
                            </div>
                            <h2 className="text-lg font-black uppercase tracking-tighter">Support Proxy Ready</h2>
                            <p className="text-sm text-muted-foreground max-w-xs mx-auto">Transmissions sent here are routed directly to our designated support agent.</p>
                        </div>
                    )}

                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-500`}
                        >
                            {(msg.role === 'agent' || msg.role === 'system') && (
                                <div className={`size-8 md:size-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center shrink-0 shadow-sm mt-1 ${msg.role === 'system' ? 'border-amber-500/30' : ''}`}>
                                    {msg.role === 'agent' ? <Bot size={18} className="text-primary" /> : <Shield size={18} className="text-amber-500" />}
                                </div>
                            )}

                            <div className={`max-w-[85%] md:max-w-[70%] p-5 rounded-3xl shadow-md ${msg.role === 'user'
                                ? 'bg-primary text-white rounded-tr-sm'
                                : msg.role === 'system'
                                    ? 'bg-amber-500/10 text-amber-200 border border-amber-500/20 rounded-tl-sm italic'
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
                </div>
            </div>

            <div className="p-4 md:p-6 z-40 bg-background/50 backdrop-blur-md border-t border-white/5 shrink-0">
                <div className="max-w-3xl mx-auto">
                    <form onSubmit={handleSendMessage} className="relative group">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            disabled={isSending}
                            placeholder="Type your message to support..."
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-6 pr-14 text-sm font-medium text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-all shadow-inner"
                        />
                        <button
                            type="submit"
                            disabled={!inputText.trim() || isSending}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-primary/20 text-primary hover:bg-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                        </button>
                    </form>
                    <div className="text-center mt-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest flex items-center justify-center gap-2">
                            <Shield size={10} />
                            Neural Link Secure • Active Instance: <span className="text-white font-bold">Proxy-v1</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
