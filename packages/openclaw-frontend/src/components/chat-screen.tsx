'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Terminal, Sparkles, Trash2 } from 'lucide-react';
import { ChatMessage } from '@/components/chat-message';
import { apiFetch } from '@/lib/api';
import { createClient } from '@/lib/supabase';
import type { Agent } from '@/hooks/use-agent';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface ChatScreenProps {
    agent: Agent;
}

export function ChatScreen({ agent }: ChatScreenProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [streaming, setStreaming] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const supabase = createClient();

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Initial fetch and Subscription
    useEffect(() => {
        const fetchHistory = async () => {
            const { data, error } = await supabase
                .from('agent_conversations')
                .select('*')
                .eq('agent_id', agent.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (!error && data) {
                const history: Message[] = data.reverse().map((msg: any) => ({
                    id: msg.id,
                    role: (msg.sender === 'user' ? 'user' : 'assistant') as "user" | "assistant",
                    content: msg.content,
                    timestamp: new Date(msg.created_at),
                }));
                // Filter out commands meant only for terminal if desired
                // For now, let's just show everything.
                setMessages(history);
            }
        };

        fetchHistory();

        // Subscribe to new messages
        const channel = supabase
            .channel(`chat-${agent.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'agent_conversations',
                    filter: `agent_id=eq.${agent.id}`,
                },
                (payload) => {
                    const newMsg = payload.new;
                    const role = newMsg.sender === 'user' ? 'user' : 'assistant';

                    // Update messages: avoid duplicates if we optimistically added
                    setMessages((prev) => {
                        if (prev.some(m => m.id === newMsg.id)) return prev;

                        return [
                            ...prev,
                            {
                                id: newMsg.id,
                                role: role as 'user' | 'assistant',
                                content: newMsg.content,
                                timestamp: new Date(newMsg.created_at),
                            }
                        ];
                    });

                    if (role === 'assistant') {
                        setStreaming(false);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [agent.id, supabase]);

    // Auto-resize textarea
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        const el = e.target;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    };

    const sendMessage = async () => {
        const text = input.trim();
        if (!text || sending) return;

        // Optimistic update
        const userMessageId = crypto.randomUUID();
        const userMessage: Message = {
            id: userMessageId,
            role: 'user',
            content: text,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setSending(true);
        setStreaming(true);

        // Reset textarea height
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
        }

        try {
            await apiFetch<{ message: string }>(`/agents/${agent.id}/chat`, {
                method: 'POST',
                body: JSON.stringify({ content: text }),
            });
            // Response will arrive via Supabase subscription
        } catch {
            const assistantMessage: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: `Error: Unable to reach your agent. Please check your connection.`,
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, assistantMessage]);
            setStreaming(false);
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const clearMessages = () => {
        if (confirm('Clear chat history from view?')) {
            setMessages([]);
        }
    };

    return (
        <div className="flex flex-col h-full relative">
            {/* Header info / Actions */}
            {messages.length > 0 && (
                <div className="absolute top-0 right-0 p-4 z-10">
                    <button
                        onClick={clearMessages}
                        className="p-2 rounded-xl bg-white/5 border border-white/10 hover:border-red-500/30 hover:bg-red-500/5 text-muted-foreground hover:text-red-400 transition-all active:scale-95"
                        title="Clear view"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            )}

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto scroll-smooth-mobile pb-4 pt-2">
                {messages.length === 0 ? (
                    /* Empty state */
                    <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
                        <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6 animate-glow">
                            <Terminal className="w-10 h-10 text-primary" />
                        </div>
                        <h2 className="text-xl font-black tracking-tight mb-2">
                            {agent.name || 'Your Agent'} is Ready
                        </h2>
                        <p className="text-muted-foreground text-sm max-w-xs leading-relaxed mb-8">
                            Start a conversation with your AI agent. Type a message below to get started.
                        </p>

                        {/* Quick prompts */}
                        <div className="flex flex-col gap-2 w-full max-w-xs">
                            {[
                                'Wake up!',
                                'Choose an identity for yourself',
                                'Help me brainstorm ideas',
                            ].map((prompt) => (
                                <button
                                    key={prompt}
                                    onClick={() => {
                                        setInput(prompt);
                                        inputRef.current?.focus();
                                    }}
                                    className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/30 hover:bg-primary/5 text-sm text-white/70 hover:text-white transition-all text-left active:scale-[0.98]"
                                >
                                    <Sparkles size={14} className="text-primary/60 flex-shrink-0" />
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="pt-4">
                        {messages.map((msg) => (
                            <ChatMessage
                                key={msg.id}
                                role={msg.role}
                                content={msg.content}
                                timestamp={msg.timestamp}
                                isStreaming={streaming && msg === messages[messages.length - 1] && msg.role === 'assistant'}
                            />
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Input bar — fixed at bottom */}
            <div className="flex-shrink-0 border-t border-white/5 bg-background/80 backdrop-blur-xl px-4 py-3 pb-[calc(0.75rem+var(--safe-area-bottom))]">
                <div className="flex items-end gap-2 max-w-3xl mx-auto">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Message your agent..."
                        rows={1}
                        className="flex-1 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all resize-none min-h-[48px] max-h-[120px]"
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!input.trim() || sending}
                        className="flex-shrink-0 w-12 h-12 rounded-2xl bg-primary hover:opacity-90 active:scale-[0.92] text-white flex items-center justify-center transition-all shadow-lg shadow-primary/20 disabled:opacity-30 disabled:pointer-events-none"
                    >
                        {sending ? (
                            <Loader2 size={20} className="animate-spin" />
                        ) : (
                            <Send size={20} />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
