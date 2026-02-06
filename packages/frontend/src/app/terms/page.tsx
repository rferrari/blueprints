import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-background relative overflow-hidden p-6 md:p-12">
            <div className="max-w-3xl mx-auto relative z-10">
                <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-white transition-colors mb-12 group">
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    Back to Home
                </Link>

                <div className="mb-12">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
                        <Shield size={14} className="text-amber-400" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Legal</span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter mb-6">Terms of Phase</h1>
                    <p className="text-xl text-muted-foreground font-medium leading-relaxed">
                        Conditions for operating within the Neural Grid.
                    </p>
                </div>

                <div className="prose prose-invert prose-lg max-w-none">
                    <div className="p-8 rounded-3xl border border-white/5 bg-white/[0.02] space-y-6">
                        <section>
                            <h3 className="text-xl font-bold mb-3 text-white">1. Deployment Protocol</h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                By deploying agents to the cluster, you agree to maintain responsible AI oversight.
                                Agents must not be used for malicious purposes, network disruption, or unauthorized data extraction.
                            </p>
                        </section>
                        <section>
                            <h3 className="text-xl font-bold mb-3 text-white">2. Compute Resources</h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                Resource allocation is dynamic. Excessive consumption may result in temporary throttling
                                to ensure grid stability for all operators.
                            </p>
                        </section>
                        <section>
                            <h3 className="text-xl font-bold mb-3 text-white">3. Data Sovereignty</h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                All agent memory and state are cryptographically isolated. You retain full ownership
                                of your agents' neural patterns and generated data.
                            </p>
                        </section>
                        <p className="text-xs text-muted-foreground/30 font-mono pt-8">
                            Last Updated: 2026.02.05 // Protocol v2.1
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
