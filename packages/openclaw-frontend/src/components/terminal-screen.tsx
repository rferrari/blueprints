'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2, Terminal as TerminalIcon } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { createClient } from '@/lib/supabase';
import type { Agent } from '@/hooks/use-agent';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    isCommand?: boolean;
}

interface TerminalScreenProps {
    agent: Agent;
}

export function TerminalScreen({ agent }: TerminalScreenProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Initial fetch of recent history
    useEffect(() => {
        const fetchHistory = async () => {
            const { data, error } = await supabase
                .from('agent_conversations')
                .select('*')
                .eq('agent_id', agent.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (!error && data) {
                const history = data.reverse().map((msg: any) => ({
                    id: msg.id,
                    role: msg.sender === 'user' ? 'user' : 'assistant',
                    content: msg.content,
                    timestamp: new Date(msg.created_at),
                    isCommand: msg.content.startsWith('/terminal')
                }));
                // Clean up /terminal prefix for display if it's a command
                const cleanedHistory = history.map((msg: Message) => ({
                    ...msg,
                    content: msg.role === 'user' && msg.content.startsWith('/terminal ')
                        ? msg.content.replace('/terminal ', '')
                        : msg.content
                }));
                setMessages(cleanedHistory);
            }
        };

        fetchHistory();

        // Subscribe to new messages
        const channel = supabase
            .channel(`terminal-${agent.id}`)
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

                    // We might have already optimistically added the user message
                    // So we could dedup, but for now simple append is safer for the "response" part.
                    // Actually, let's just ignore own user messages arriving via socket to avoid easy duplication
                    // OR specifically handle them.
                    // For the "response", we definitely want it.

                    if (role === 'assistant') {
                        setMessages((prev) => [
                            ...prev,
                            {
                                id: newMsg.id,
                                role: 'assistant',
                                content: newMsg.content,
                                timestamp: new Date(newMsg.created_at),
                                isCommand: false
                            }
                        ]);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [agent.id, supabase]);

    const sendCommand = async () => {
        const text = input.trim();
        if (!text || sending) return;

        // Auto-prefix with /terminal if not present
        const commandContent = text.startsWith('/terminal') ? text : `/terminal ${text}`;

        // Optimistic update
        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content: text, // Show what user typed (without prefix if they didn't type it)
            timestamp: new Date(),
            isCommand: true
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setSending(true);

        try {
            await apiFetch<{ message: string }>(`/agents/${agent.id}/chat`, {
                method: 'POST',
                body: JSON.stringify({ content: commandContent }),
            });
            // Output will arrive via subscription
        } catch {
            const errorMessage: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: `Error executing command: connection failed.`,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendCommand();
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#0c0c0c] font-mono text-sm">
            {/* Terminal Header */}
            <div className="flex items-center px-4 py-2 border-b border-white/10 bg-black/20 text-xs text-muted-foreground">
                <TerminalIcon size={14} className="mr-2" />
                <span>{agent.name}@openclaw:~/workspace</span>
                <div className="ml-auto flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500/50 animate-pulse" />
                    <span className="text-[10px] uppercase font-bold text-green-500">Connected</span>
                </div>
            </div>

            {/* Output Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {messages.length === 0 ? (
                    <div className="text-white/30 mt-4">
                        <p>OpenClaw Terminal Interface v1.0.2</p>
                        <p>Connected to container <span className="text-blue-400">{agent.id.slice(0, 8)}</span></p>
                        <br />
                        <p>Type commands to execute in the agent&apos;s environment.</p>
                        <p>Example: <span className="text-white/60">ls -la</span>, <span className="text-white/60">node -v</span></p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div key={msg.id} className="break-all">
                            {msg.role === 'user' ? (
                                <div className="flex items-center gap-2 text-white/90">
                                    <span className="text-green-500 font-bold">➜</span>
                                    <span className="text-blue-400">~</span>
                                    <span>{msg.content}</span>
                                </div>
                            ) : (
                                <div className="text-white/70 whitespace-pre-wrap pl-6 border-l-2 border-white/5 ml-1 mt-1">
                                    {msg.content}
                                </div>
                            )}
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Line */}
            <div className="flex-shrink-0 p-4 bg-black/40 border-t border-white/5">
                <div className="flex items-center gap-2">
                    <span className="text-green-500">➜</span>
                    <span className="text-blue-400">~</span>
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a command..."
                        className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/20"
                        autoComplete="off"
                        autoFocus
                    />
                    {sending && <Loader2 size={16} className="animate-spin text-white/40" />}
                </div>
            </div>
        </div>
    );
}
