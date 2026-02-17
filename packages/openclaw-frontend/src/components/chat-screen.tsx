'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Terminal, Sparkles } from 'lucide-react';
import { ChatMessage } from '@/components/chat-message';
import { apiFetch } from '@/lib/api';
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

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

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

        const userMessage: Message = {
            id: crypto.randomUUID(),
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
            // Stub: Call backend chat API
            const response = await apiFetch<{ message: string }>(`/agents/${agent.id}/chat`, {
                method: 'POST',
                body: JSON.stringify({ message: text }),
            });

            const assistantMessage: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: response.message || 'I received your message. Let me process that...',
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch {
            // Stub fallback — simulate response when backend is unavailable
            const assistantMessage: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: `I'm your OpenClaw agent "${agent.name}". The chat API is being set up — I'll be fully operational soon! 🦀`,
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, assistantMessage]);
        } finally {
            setSending(false);
            setStreaming(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto scroll-smooth-mobile pb-4">
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
                                'What can you help me with?',
                                'Tell me about yourself',
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
