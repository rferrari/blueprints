import type { Metadata } from 'next';
import { Inter, Outfit } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });

// eslint-disable-next-line react-refresh/only-export-components
export const metadata: Metadata = {
    title: 'Blueprints | Agents Launchpad',
    description: 'Launch and Manage AI Agents Easily',
};

import { AuthProvider } from '@/components/auth-provider';
import { NotificationProvider } from '@/components/notification-provider';

import QueryProvider from '@/components/query-provider';

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark">
            <body className={`${inter.variable} ${outfit.variable} font-outfit min-h-screen bg-background text-foreground antialiased selection:bg-primary/30`}>
                <Script
                    src="https://www.googletagmanager.com/gtag/js?id=G-TDKKXRG9RE"
                    strategy="afterInteractive"
                />
                <Script id="google-analytics" strategy="afterInteractive">
                    {`
                        window.dataLayer = window.dataLayer || [];
                        function gtag(){dataLayer.push(arguments);}
                        gtag('js', new Date());

                        gtag('config', 'G-TDKKXRG9RE');
                    `}
                </Script>
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
