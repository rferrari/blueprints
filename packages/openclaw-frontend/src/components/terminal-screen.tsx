'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2, Terminal as TerminalIcon, Trash2 } from 'lucide-react';
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

/**
 * Strip ANSI escape codes and common terminal control sequences from output.
 * Handles color codes, cursor movement, bracketed paste, etc.
 */
function stripAnsi(str: string): string {
    return str
        // ESC [ ... m  (CSI sequences: colors, cursor, etc.)
        .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
        // ESC ] ... ST  (OSC sequences)
        .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
        // ESC ( or ) ... (character set designation)
        .replace(/\x1b[()][A-Za-z0-9]/g, '')
        // Lone ESC + single char
        .replace(/\x1b[^[\]()]/g, '')
        // Remaining lone ESC
        .replace(/\x1b/g, '')
        // Carriage returns (keep newlines)
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '')
        // Backspace sequences (e.g. "X\bY" → "Y")
        .replace(/.\x08/g, '')
        .trim();
}

/**
 * Resolve user input to the actual command string to send.
 * - `openclaw <args>` → `/terminal node /app/openclaw.mjs <args>`
 * - Otherwise → `/terminal <input>` (normal terminal)
 */
function resolveCommand(text: string): string {
    // Already a full /terminal … prefix — pass through
    if (text.startsWith('/terminal')) return text;

    // "openclaw …" alias
    if (text.toLowerCase().startsWith('openclaw')) {
        const args = text.slice('openclaw'.length).trim();
        return `/terminal node /app/openclaw.mjs${args ? ' ' + args : ''}`;
    }

    return `/terminal ${text}`;
}

/**
 * Given the raw content stored in agent_conversations, decide whether this
 * message belongs to the terminal (vs chat).
 */
function isTerminalRow(sender: string, content: string): boolean {
    if (sender === 'user' && content.startsWith('/')) return true;
    if (sender === 'agent' && /^\$ /.test(content)) return true;
    return false;
}

export function TerminalScreen({ agent }: TerminalScreenProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [commandHistory, setCommandHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [tempInput, setTempInput] = useState('');
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
            try {
                const data = await apiFetch<any[]>(`/agents/${agent.id}/chat`);
                if (data) {
                    // Keep only terminal messages (user /commands and agent $ output)
                    const terminalRows = data.filter((msg: any) => isTerminalRow(msg.sender, msg.content));

                    const history: Message[] = terminalRows.map((msg: any) => ({
                        id: msg.id,
                        role: (msg.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
                        content: msg.sender === 'agent' ? stripAnsi(msg.content) : msg.content,
                        timestamp: new Date(msg.created_at),
                        isCommand: msg.sender === 'user',
                    }));

                    // Build command history from user messages for ↑↓ recall
                    const userCommands = terminalRows
                        .filter((m: any) => m.sender === 'user' && m.content.startsWith('/terminal '))
                        .map((m: any) => m.content.replace('/terminal ', ''));
                    setCommandHistory(userCommands);

                    // Clean /terminal prefix for display
                    const displayHistory = history.map((msg: Message) => ({
                        ...msg,
                        content: msg.role === 'user' && msg.content.startsWith('/terminal ')
                            ? msg.content.replace('/terminal ', '')
                            : msg.content,
                    }));
                    setMessages(displayHistory);
                }
            } catch (err) {
                console.error('Failed to fetch terminal history:', err);
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
                (payload: { new: any }) => {
                    const newMsg = payload.new;

                    // Only handle terminal messages here
                    if (!isTerminalRow(newMsg.sender, newMsg.content)) return;

                    if (newMsg.sender === 'agent') {
                        setMessages((prev) => [
                            ...prev,
                            {
                                id: newMsg.id,
                                role: 'assistant',
                                content: stripAnsi(newMsg.content),
                                timestamp: new Date(newMsg.created_at),
                                isCommand: false,
                            }
                        ]);
                    }
                    // User messages arrive optimistically; skip to avoid duplication
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

        // Resolve alias and build the wire command
        const commandContent = resolveCommand(text);

        // The display label is always just what the user typed
        const displayText = text;

        // Add to ↑↓ history
        setCommandHistory(prev => {
            const next = [...prev, displayText];
            return next.length > 100 ? next.slice(next.length - 100) : next;
        });
        setHistoryIndex(-1);
        setTempInput('');

        // Optimistic update — show the user's typed text immediately
        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content: displayText,
            timestamp: new Date(),
            isCommand: true,
        };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setSending(true);

        try {
            await apiFetch<{ message: string }>(`/agents/${agent.id}/chat`, {
                method: 'POST',
                body: JSON.stringify({ content: commandContent }),
            });
            // Output arrives via subscription
        } catch {
            const errorMessage: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: `Error: Command execution failed.`,
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
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (commandHistory.length === 0) return;
            const newIndex = historyIndex + 1;
            if (newIndex < commandHistory.length) {
                if (historyIndex === -1) setTempInput(input);
                setHistoryIndex(newIndex);
                setInput(commandHistory[commandHistory.length - 1 - newIndex]);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex > 0) {
                const newIndex = historyIndex - 1;
                setHistoryIndex(newIndex);
                setInput(commandHistory[commandHistory.length - 1 - newIndex]);
            } else if (historyIndex === 0) {
                setHistoryIndex(-1);
                setInput(tempInput);
            }
        }
    };

    const clearMessages = () => {
        if (confirm('Clear terminal history from view?')) {
            setMessages([]);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#0c0c0c] font-mono text-sm">
            {/* Terminal Header */}
            <div className="flex items-center px-4 py-2 border-b border-white/10 bg-black/20 text-xs text-muted-foreground">
                <TerminalIcon size={14} className="mr-2" />
                <span>{agent.name}@openclaw:/agent-home</span>
                <div className="ml-auto flex items-center gap-3">
                    <button
                        onClick={clearMessages}
                        className="hover:text-red-400 transition-colors"
                        title="Clear view"
                    >
                        <Trash2 size={14} />
                    </button>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500/50 animate-pulse" />
                        <span className="text-[10px] uppercase font-bold text-green-500">Connected</span>
                    </div>
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
                        <p>Examples: <span className="text-white/60">ls -la</span>, <span className="text-white/60">node -v</span></p>
                        <p className="mt-2">Shortcut: <span className="text-white/60">openclaw status</span> → runs <span className="text-white/50">node /app/openclaw.mjs status</span></p>
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
                        placeholder="Type a command... (openclaw status, ls, node -v)"
                        className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/20"
                        autoComplete="off"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        autoFocus
                    />
                    {sending && <Loader2 size={16} className="animate-spin text-white/40" />}
                </div>
            </div>
        </div>
    );
}
