import Link from 'next/link';
import { ArrowLeft, Book, Code, Terminal } from 'lucide-react';

export default function DocumentationPage() {
    return (
        <div className="min-h-screen bg-background relative overflow-hidden p-6 md:p-12">
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -translate-y-1/2" />

            <div className="max-w-4xl mx-auto relative z-10">
                <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-white transition-colors mb-12 group">
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    Back to Home
                </Link>

                <div className="mb-12">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
                        <Book size={14} className="text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Knowledge Base</span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter mb-6">Documentation</h1>
                    <p className="text-xl text-muted-foreground font-medium leading-relaxed">
                        Complete guides for deploying, managing, and orchestrating your autonomous agent clusters.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {['Quick Start', 'Architecture', 'API Reference', 'Security Model'].map((item) => (
                        <div key={item} className="p-8 rounded-3xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors cursor-pointer group">
                            <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{item}</h3>
                            <p className="text-sm text-muted-foreground">Detailed documentation coming soon.</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
