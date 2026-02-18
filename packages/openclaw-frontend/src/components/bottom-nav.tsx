import React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MessageSquare, Settings, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BottomNav() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const currentView = searchParams.get('view') || 'chat';

    const NAV_ITEMS = [
        {
            href: '/?view=chat',
            label: 'Chat',
            icon: MessageSquare,
            isActive: pathname === '/' && (currentView === 'chat' || !searchParams.has('view'))
        },
        {
            href: '/?view=terminal',
            label: 'Terminal',
            icon: Terminal,
            isActive: pathname === '/' && currentView === 'terminal'
        },
        {
            href: '/settings',
            label: 'Settings',
            icon: Settings,
            isActive: pathname === '/settings'
        },
    ];

    return (
        <nav className="flex-shrink-0 border-t border-white/5 bg-background/80 backdrop-blur-xl pb-[var(--safe-area-bottom)]">
            <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
                {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            replace={item.href.startsWith('/?')} // Use replace for tab switching to avoid history stack buildup
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
