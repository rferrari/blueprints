import Link from 'next/link';
import { ArrowLeft, Server, Database, Globe } from 'lucide-react';

export default function InfrastructurePage() {
    return (
        <div className="min-h-screen bg-background relative overflow-hidden p-6 md:p-12">
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] translate-y-1/2" />

            <div className="max-w-4xl mx-auto relative z-10">
                <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-white transition-colors mb-12 group">
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    Back to Home
                </Link>

                <div className="mb-12">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
                        <Server size={14} className="text-purple-400" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">System Status</span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter mb-6">Infrastructure</h1>
                    <p className="text-xl text-muted-foreground font-medium leading-relaxed">
                        Real-time metrics and topology of the Neural Grid.
                    </p>
                </div>

                <div className="space-y-6">
                    <div className="p-8 rounded-3xl border border-white/5 bg-white/[0.02]">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="size-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500">
                                <Globe size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Global Edge Network</h3>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Operation Normal</p>
                            </div>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full w-full bg-green-500/50 animate-pulse" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-6 rounded-3xl border border-white/5 bg-white/[0.02]">
                            <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-widest mb-2">Active Nodes</h4>
                            <p className="text-4xl font-black text-white">4,291</p>
                        </div>
                        <div className="p-6 rounded-3xl border border-white/5 bg-white/[0.02]">
                            <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-widest mb-2">Uptime</h4>
                            <p className="text-4xl font-black text-white">99.99%</p>
                        </div>
                    </div>

                    {/* Eliza Cluster Engine Highlights */}
                    <div className="p-8 rounded-3xl border border-purple-500/20 bg-purple-500/5 mt-6">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="size-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                                <Server size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-white">Eliza Cluster Engine</h3>
                                <p className="text-xs font-medium text-purple-400 uppercase tracking-widest">Live • Version 2.0</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <h4 className="font-bold text-white mb-2">Zero-Downtime Management</h4>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Agents can be added, removed, or updated via CLI without restarting the cluster container.
                                </p>
                            </div>
                            <div>
                                <h4 className="font-bold text-white mb-2">Hot-Reload Capabilities</h4>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Dynamic configuration injection allows for instant character updates in milliseconds.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
