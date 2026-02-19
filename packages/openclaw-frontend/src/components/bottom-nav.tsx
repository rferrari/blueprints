import React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MessageSquare, Settings, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAgent } from '@/hooks/use-agent';

export function BottomNav() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { agent } = useAgent();
    const currentView = searchParams.get('view') || 'chat';
    const hasAgent = !!agent;

    const NAV_ITEMS = [
        {
            href: '/?view=chat',
            label: 'Chat',
            icon: MessageSquare,
            isActive: pathname === '/' && (currentView === 'chat' || !searchParams.has('view')),
            disabled: !hasAgent
        },
        {
            href: '/?view=terminal',
            label: 'Terminal',
            icon: Terminal,
            isActive: pathname === '/' && currentView === 'terminal',
            disabled: !hasAgent
        },
        {
            href: '/settings',
            label: 'Settings',
            icon: Settings,
            isActive: pathname === '/settings',
            disabled: false
        },
    ];

    return (
        <nav className="flex-shrink-0 border-t border-white/5 bg-background/80 backdrop-blur-xl pb-[var(--safe-area-bottom)]">
            <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
                {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;

                    if (item.disabled) {
                        return (
                            <div
                                key={item.href}
                                className="flex flex-col items-center justify-center gap-1 w-20 h-full opacity-30 grayscale cursor-not-allowed"
                            >
                                <div className="flex items-center justify-center w-10 h-10 rounded-2xl">
                                    <Icon size={22} />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                    {item.label}
                                </span>
                            </div>
                        );
                    }

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            replace={item.href.startsWith('/?')}
                            className={cn(
                                'flex flex-col items-center justify-center gap-1 w-20 h-full transition-all active:scale-[0.92]',
                                item.isActive
                                    ? 'text-primary'
                                    : 'text-muted-foreground hover:text-white/70'
                            )}
                        >
                            <div className={cn(
                                'flex items-center justify-center w-10 h-10 rounded-2xl transition-all',
                                item.isActive ? 'bg-primary/10' : ''
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
