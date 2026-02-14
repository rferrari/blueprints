'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, Loader2, Sparkles, Trash2, Shield, MoreHorizontal, MessageSquare, Terminal, X } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { createClient } from '@/lib/supabase';

interface ChatMessage {
    id: string;
    content: string;
    sender: 'user' | 'agent';
    created_at: string;
}

export default function ChatInterface({ agentId, onClose }: { agentId: string; onClose?: () => void }) {
    const { session } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [thinkingTime, setThinkingTime] = useState(0);
    const [agentModel, setAgentModel] = useState<string>('LLM');
    const [agentName, setAgentName] = useState<string>('Neural Agent');
    const scrollRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const scrollToBottom = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    };

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (loading) {
            setThinkingTime(0);
            scrollToBottom();

            // Safety timeout: Clear loading if no response for 125s (worker is 120s)
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                setLoading(false);
            }, 125000);

            interval = setInterval(() => {
                setThinkingTime(prev => prev + 1);
            }, 1000);
        } else {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        }
        return () => {
            clearInterval(interval);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [loading]);

    // Auto-scroll when thinking time updates (to keep new bubbles in view)
    useEffect(() => {
        if (loading) {
            scrollToBottom();
        }
    }, [thinkingTime, loading]);

    const supabase = createClient();

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    useEffect(() => {
        if (session?.access_token) {
            fetchChatHistory();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [agentId, session]);

    // Real-time subscription
    useEffect(() => {
        const channel = supabase
            .channel(`agent_conversations:${agentId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'agent_conversations',
                filter: `agent_id=eq.${agentId}`
            }, (payload) => {
                const newMessage = payload.new as ChatMessage;

                // If we get an agent message, stop thinking
                if (newMessage.sender === 'agent') {
                    setLoading(false);
                }

                setMessages((prev: ChatMessage[]) => {
                    if (prev.find(m => m.id === newMessage.id)) return prev;
                    const updated = [...prev, newMessage];
                    // Immediate scroll for new messages
                    setTimeout(scrollToBottom, 50);
                    return updated;
                });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [agentId, supabase]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (session?.access_token) {
            fetchAgentDetails();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [agentId, session]);

    const fetchAgentDetails = async () => {
        try {
            // Fetch name from agents table and config from desired state
            const [agentRes, configRes] = await Promise.all([
                supabase.from('agents').select('name').eq('id', agentId).single(),
                supabase.from('agent_desired_state').select('config').eq('agent_id', agentId).single()
            ]);

            if (agentRes.data?.name) {
                setAgentName(agentRes.data.name);
            }

            if (configRes.data?.config) {
                const config = configRes.data.config;
                const primaryModel = config.agents?.defaults?.model?.primary ||
                    config.models?.providers?.venice?.models?.[0]?.id ||
                    'AI';

                const modelName = primaryModel.split('/').pop().toUpperCase();
                setAgentModel(modelName);
            }
        } catch (err) {
            console.error('Failed to fetch agent details:', err);
        }
    };

    const fetchChatHistory = async () => {
        try {
            setFetching(true);
            const res = await fetch(`${API_URL}/agents/${agentId}/chat`, {
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch chat history');
            const data = await res.json();
            setMessages(data);
            setTimeout(scrollToBottom, 100);
        } catch (err) {
            console.error(err);
        } finally {
            setFetching(false);
        }
    };

    const [isTerminalMode, setIsTerminalMode] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || loading || !session?.access_token) return;

        let userMsgContent = input.trim();

        if (isTerminalMode && !userMsgContent.startsWith('/terminal ')) {
            userMsgContent = `/terminal ${userMsgContent}`;
        }

        setInput('');
        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/agents/${agentId}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ content: userMsgContent })
            });

            if (!res.ok) {
                setLoading(false);
                throw new Error('Failed to send message');
            }
        } catch (err) {
            console.error(err);
            setLoading(false); // Only clear on error
        }
    };

    const showHelp = () => {
        const helpId = Math.random().toString(36).substring(7);
        const helpMsg: ChatMessage = {
            id: helpId,
            sender: 'agent',
            content: `🖥️ Terminal Guide\n\n**Dual Routing System**:\n1. **Terminal Mode**: Every message is automatically executed as a shell command.\n2. **Chat Mode**: You can still run commands by prefixing them with \`/terminal \`.\n\n**Quick Commands**:\n• \`ls -la\` (List files)\n• \`pwd\` (Print working directory)\n• \`whoami\` (Check user context)\n\nSwitch modes anytime using the ⋮ menu.`,
            created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, helpMsg]);
        setMenuOpen(false);
        setTimeout(scrollToBottom, 50);
    };

    if (fetching) {
        return (
            <div className="h-[600px] flex items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={40} />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[700px] glass-card rounded-[3rem] overflow-hidden border-white/5 bg-slate-950/40 relative">
            {/* Chat Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02] backdrop-blur-md relative z-10">
                <div className="flex items-center gap-4">
                    <div className="size-10 rounded-full bg-gradient-unicorn p-0.5 animate-pulse">
                        <div className="w-full h-full bg-background rounded-full flex items-center justify-center">
                            <Bot size={20} />
                        </div>
                    </div>
                    <div>
                        <h3 className="font-black text-sm uppercase tracking-widest text-white flex items-center gap-2">
                            Agent Neural Link
                            <span className="text-white/20">|</span>
                            <span className="text-primary">{agentName}</span>
                            <span className="size-2 rounded-full bg-green-500 animate-pulse" />
                        </h3>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Secure Multi-tenant Socket</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 relative">
                    <div className="flex items-center gap-1 px-3 py-1 bg-white/5 rounded-full border border-white/5 mr-2">
                        <div className={`size-1.5 rounded-full ${isTerminalMode ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]'}`} />
                        <span className="text-[9px] font-black uppercase tracking-tighter text-white/70">
                            {isTerminalMode ? 'Terminal Mode' : 'Neutral Mode'}
                        </span>
                    </div>

                    <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        className={`p-2 hover:bg-white/5 rounded-xl transition-colors ${menuOpen ? 'bg-white/10 text-white' : 'text-muted-foreground'}`}
                    >
                        <MoreHorizontal size={20} />
                    </button>

                    {menuOpen && (
                        <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            <button
                                onClick={() => {
                                    setIsTerminalMode(!isTerminalMode);
                                    setMenuOpen(false);
                                }}
                                className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-[10px] font-black uppercase tracking-widest text-left"
                            >
                                <div className="flex items-center gap-3">
                                    {isTerminalMode ? <MessageSquare size={16} /> : <Terminal size={16} />}
                                    {isTerminalMode ? 'Switch to Chat' : 'Switch to Terminal'}
                                </div>
                                {isTerminalMode && <div className="size-2 rounded-full bg-amber-500" />}
                            </button>

                            <button
                                onClick={showHelp}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-[10px] font-black uppercase tracking-widest text-left"
                            >
                                <Shield size={16} /> Terminal Help
                            </button>

                            <div className="h-px bg-white/5 my-2" />

                            <button
                                onClick={() => {
                                    setMessages([]);
                                    setMenuOpen(false);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-colors text-[10px] font-black uppercase tracking-widest text-left"
                            >
                                <Trash2 size={16} /> Clear Buffer
                            </button>

                            {onClose && (
                                <button
                                    onClick={onClose}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-[10px] font-black uppercase tracking-widest text-left"
                                >
                                    <X size={16} /> Close
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Messages Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth"
            >
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-10 space-y-4">
                        <div className="size-20 rounded-3xl bg-white/5 flex items-center justify-center text-muted-foreground/20">
                            <Sparkles size={40} />
                        </div>
                        <div>
                            <p className="font-black text-muted-foreground/40 uppercase tracking-[0.2em] text-xs">No Signal Detected</p>
                            <p className="text-sm text-muted-foreground/30 font-medium max-w-xs">Initialize the conversation by sending a command to your agent.</p>
                        </div>
                    </div>
                )}
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}
                    >
                        <div className={`flex gap-3 max-w-[80%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`size-8 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${msg.sender === 'user' ? 'bg-indigo-500 text-white' : 'bg-primary text-white'
                                }`}>
                                {msg.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
                            </div>
                            <div className={`p-4 rounded-[1.5rem] text-sm font-medium leading-relaxed ${msg.sender === 'user'
                                ? 'bg-indigo-500 text-white rounded-tr-none shadow-xl shadow-indigo-500/10'
                                : 'bg-white/5 border border-white/5 text-slate-200 rounded-tl-none'
                                } whitespace-pre-wrap`}>
                                {msg.content.startsWith('/terminal ') ? msg.content.replace('/terminal ', '') : msg.content}
                            </div>
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex gap-3 max-w-[80%] flex-row">
                            <div className="size-8 rounded-xl flex items-center justify-center shrink-0 shadow-lg bg-primary text-white">
                                <Bot size={16} />
                            </div>
                            <div className="p-4 rounded-[1.5rem] bg-white/5 border border-white/5 text-slate-400 rounded-tl-none flex items-center gap-3">
                                <Loader2 size={14} className="animate-spin text-primary" />
                                <span className="text-xs font-bold uppercase tracking-widest italic animate-pulse">
                                    {isTerminalMode ? (
                                        thinkingTime < 5 ? 'Console Initializing' :
                                            thinkingTime < 15 ? 'Executing Shell Command' :
                                                thinkingTime < 30 ? 'Processing Output Stream' :
                                                    'Long-Running Process in Progress'
                                    ) : (
                                        thinkingTime < 5 ? 'Neural Initializing' :
                                            thinkingTime < 15 ? `Querying ${agentModel}` :
                                                thinkingTime < 30 ? 'Synthesizing Thought Matrix' :
                                                    'Heavy Inference in Progress'
                                    )}
                                    {thinkingTime > 0 ? ` (${thinkingTime}s)` : '...'}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="p-6 bg-white/[0.02] border-t border-white/5 relative z-10">
                <div className="relative group">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={isTerminalMode ? "Enter terminal command..." : "Transmit message..."}
                        className={`w-full bg-white/5 border rounded-2xl py-4 pl-6 pr-14 outline-none transition-all font-medium text-sm text-white placeholder:text-muted-foreground/30 ${isTerminalMode ? 'border-amber-500/30 focus:border-amber-500/50 bg-amber-500/[0.03]' : 'border-white/5 focus:border-primary/50 focus:bg-white/[0.08]'
                            }`}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || loading}
                        className="absolute right-2 top-1/2 -translate-y-1/2 size-10 flex items-center justify-center rounded-xl bg-primary text-white hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
                    >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                </div>
            </form>

            {/* Background Decorations */}
            <div className="absolute -bottom-20 -left-20 size-60 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute -top-20 -right-20 size-60 bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none" />
        </div>
    );
}
