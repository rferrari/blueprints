'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';

interface ChatMessageProps {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: Date;
    isStreaming?: boolean;
}

export function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
    const isUser = role === 'user';

    return (
        <div className={cn(
            'flex gap-3 px-4 py-3 max-w-full',
            isUser ? 'flex-row-reverse' : 'flex-row'
        )}>
            {/* Avatar */}
            <div className={cn(
                'flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center',
                isUser
                    ? 'bg-primary/20 text-primary'
                    : 'bg-white/10 text-white/70'
            )}>
                {isUser ? <User size={16} /> : <Bot size={16} />}
            </div>

            {/* Bubble */}
            <div className={cn(
                'rounded-2xl px-4 py-3 max-w-[80%] text-sm leading-relaxed whitespace-pre-wrap break-words',
                isUser
                    ? 'bg-primary/20 text-white rounded-tr-md'
                    : 'bg-white/5 border border-white/10 text-white/90 rounded-tl-md'
            )}>
                {content}
                {isStreaming && (
                    <span className="inline-block w-1.5 h-4 bg-primary/60 rounded-sm ml-1 animate-pulse" />
                )}
            </div>
        </div>
    );
}
