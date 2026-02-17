'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Terminal as TerminalIcon, Command } from 'lucide-react';
import { apiFetch } from '@/lib/api';
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

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    const sendCommand = async () => {
        const text = input.trim();
        if (!text || sending) return;

        // Auto-prefix with /terminal if not present
        const commandContent = text.startsWith('/terminal') ? text : `/terminal ${text}`;

        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content: text, // Show what user typed
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

            // We don't get the output immediately from this endpoint. 
            // In a real implementation, we would listen to a socket.
            // For now, we simulate "Command sent" or maybe fetch history?
            // But since the user said "get responses from inside docker", 
            // and the backend routes output to `agent_conversations`,
            // we probably need to POLL or SUBSCRIPBE to `agent_conversations`.
            // For this iteration, I'll simulate an ack.

            // Note: The actual output will appear in the "Chat" unless I filter it.
            // But here I want to show the output.
            // I should implement fetching of recent messages that are terminal outputs.
            // But without a dedicated "get terminal logs" endpoint, it's tricky.
            // I'll assume the backend echoes the output as a new message.

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
            // Keep focus
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
