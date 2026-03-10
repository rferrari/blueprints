'use client';

import React from 'react';
import Link from 'next/link';
import { Terminal, Github, Twitter } from 'lucide-react';

export function Footer() {
    return (
        <footer className="py-20 border-t border-white/5">
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex flex-col md:flex-row justify-between items-start gap-12">
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                <Terminal size={20} className="text-primary" />
                            </div>
                            <span className="text-xl font-black tracking-tighter italic uppercase">Blueprints</span>
                        </div>
                        <p className="text-sm text-muted-foreground font-medium max-w-xs">
                            The ultimate agent launchpad. Empowering users with sovereign, autonomous AI assistants.
                        </p>
                        <div className="flex items-center gap-4">
                            <a href="https://github.com/blankdotspace/" target="_blank" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                <Github size={18} />
                            </a>
                            <a href="https://farcaster.xyz/~/channel/blankspace" target="_blank" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors" title="Farcaster">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" />
                                    <path d="M8 12h8" />
                                    <path d="M12 8v8" />
                                </svg>
                            </a>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-12">
                        <div className="space-y-4">
                            <h4 className="text-xs font-black uppercase tracking-widest text-white/40">Product</h4>
                            <ul className="space-y-2">
                                <li><Link href="/features" className="text-sm font-bold hover:text-primary transition-colors">Features</Link></li>
                                <li><Link href="/pricing" className="text-sm font-bold hover:text-primary transition-colors">Pricing</Link></li>
                                <li><Link href="/docs" className="text-sm font-bold hover:text-primary transition-colors">Documentation</Link></li>
                            </ul>
                        </div>
                        <div className="space-y-4">
                            <h4 className="text-xs font-black uppercase tracking-widest text-white/40">Company</h4>
                            <ul className="space-y-2">
                                <li><Link href="/about" className="text-sm font-bold hover:text-primary transition-colors">About</Link></li>
                                <li><Link href="/blog" className="text-sm font-bold hover:text-primary transition-colors">Blog</Link></li>
                                <li><Link href="/contact" className="text-sm font-bold hover:text-primary transition-colors">Contact</Link></li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-xs text-muted-foreground font-medium font-inter">
                        © 2026 Blueprints. All rights reserved.
                    </p>
                    <div className="flex items-center gap-8 text-xs font-bold uppercase tracking-widest text-white/40">
                        <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
                        <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
