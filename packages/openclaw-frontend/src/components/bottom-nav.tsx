'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { MessageSquare, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
    { href: '/', label: 'Chat', icon: MessageSquare },
    { href: '/settings', label: 'Settings', icon: Settings },
];

export function BottomNav() {
    const pathname = usePathname();

    return (
        <nav className="flex-shrink-0 border-t border-white/5 bg-background/80 backdrop-blur-xl pb-[var(--safe-area-bottom)]">
            <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
                {NAV_ITEMS.map((item) => {
                    const isActive = item.href === '/'
                        ? pathname === '/'
                        : pathname.startsWith(item.href);
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex flex-col items-center justify-center gap-1 w-20 h-full transition-all active:scale-[0.92]',
                                isActive
                                    ? 'text-primary'
                                    : 'text-muted-foreground hover:text-white/70'
                            )}
                        >
                            <div className={cn(
                                'flex items-center justify-center w-10 h-10 rounded-2xl transition-all',
                                isActive ? 'bg-primary/10' : ''
                            )}>
                                <Icon size={22} />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest">
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
