import type { Metadata, Viewport } from 'next';
import { Inter, Outfit } from 'next/font/google';
import './globals.css';

import { AuthProvider } from '@/components/auth-provider';
import { NotificationProvider } from '@/components/notification-provider';
import QueryProvider from '@/components/query-provider';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });

export const metadata: Metadata = {
    title: 'Blueprints',
    description: 'Your AI Agent, Ready in Seconds',
    manifest: undefined,
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark">
            <body className={`${inter.variable} ${outfit.variable} font-outfit min-h-[100dvh] bg-background text-foreground antialiased selection:bg-primary/30`}>
                <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950" />
                <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-purple-900/10 via-transparent to-transparent" />

                <QueryProvider>
                    <NotificationProvider>
                        <AuthProvider>
                            {children}
                        </AuthProvider>
                    </NotificationProvider>
                </QueryProvider>
            </body>
        </html>
    );
}
