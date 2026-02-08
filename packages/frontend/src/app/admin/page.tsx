'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import {
    LayoutDashboard, Users, Bot, Zap, Shield,
    ArrowLeft, Loader2, RefreshCw, AlertTriangle,
    TrendingUp, Activity, Terminal
} from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboard() {
    const [user, setUser] = useState<any>(null);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDeploying, setIsDeploying] = useState(false);
    const [deploySuccess, setDeploySuccess] = useState(false);
    const supabase = createClient();
    const router = useRouter();

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    const fetchStats = async (token: string) => {
        try {
            const res = await fetch(`${API_URL}/admin/stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) {
                if (res.status === 403) throw new Error('Administrative access denied');
                throw new Error('Failed to fetch system stats');
            }
            const data = await res.json();
            setStats(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeploySuperAgent = async () => {
        setIsDeploying(true);
        setDeploySuccess(false);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${API_URL}/admin/deploy-super-agent`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            });
            if (res.ok) {
                setDeploySuccess(true);
                setTimeout(() => setDeploySuccess(false), 5000);
                if (session?.access_token) fetchStats(session.access_token);
            } else {
                alert('Deployment failed. Check super-admin privileges.');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsDeploying(false);
        }
    };

    useEffect(() => {
        const checkAdmin = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/login');
                return;
            }
            setUser(session.user);
            fetchStats(session.access_token);
        };
        checkAdmin();
    }, [router, supabase]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <Loader2 className="size-12 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-background p-8 text-center">
                <Shield className="size-16 text-destructive mb-4" />
                <h1 className="text-2xl font-black mb-2 tracking-tighter uppercase">Access Denied</h1>
                <p className="text-muted-foreground mb-6 max-w-md">{error}</p>
                <Link href="/dashboard" className="px-6 py-3 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-transform">
                    Return to Mission Control
                </Link>
            </div>
        );
    }

    const StatCard = ({ title, value, icon: Icon, trend, color }: any) => (
        <div className="glass-card rounded-[2rem] p-8 border border-white/5 relative overflow-hidden group">
            <div className={`absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
                <Icon size={80} />
            </div>
            <div className="flex items-center gap-4 mb-4">
                <div className={`p-3 rounded-2xl bg-white/5 ${color}`}>
                    <Icon size={24} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</span>
            </div>
            <div className="flex items-end gap-3">
                <h4 className="text-4xl font-black tracking-tighter">{value}</h4>
                {trend && (
                    <div className="flex items-center gap-1 text-green-500 text-xs font-bold mb-1">
                        <TrendingUp size={14} /> {trend}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-transparent p-8">
            <div className="max-w-7xl mx-auto">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Link href="/dashboard" className="p-2 hover:bg-white/5 rounded-xl transition-colors text-muted-foreground">
                                <ArrowLeft size={20} />
                            </Link>
                            <h1 className="text-4xl font-black tracking-tighter uppercase">Super <span className="text-primary">Admin</span></h1>
                        </div>
                        <p className="text-muted-foreground font-medium ml-12">Global system oversight and autonomous agent control.</p>
                    </div>

                    <div className="flex items-center gap-4 ml-12 md:ml-0">
                        <button
                            onClick={() => { setLoading(true); fetchStats(user?.access_token); }}
                            className="p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-all group"
                        >
                            <RefreshCw size={20} className="group-active:rotate-180 transition-transform duration-500" />
                        </button>
                        <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-primary/10 border border-primary/20">
                            <Activity size={18} className="text-primary animate-pulse" />
                            <span className="text-xs font-black uppercase tracking-widest text-primary">System Live</span>
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    <StatCard title="Total Citizens" value={stats?.users} icon={Users} color="text-blue-400" />
                    <StatCard title="Active Clusters" value={stats?.projects} icon={LayoutDashboard} color="text-purple-400" />
                    <StatCard title="Total Agents" value={stats?.agents} icon={Bot} color="text-primary" />
                    <StatCard title="Failing Systems" value={stats?.failingAgents} icon={AlertTriangle} color="text-destructive" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* System Monitoring */}
                    <div className="lg:col-span-2 glass-card rounded-[3rem] p-10 border border-white/5">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-2xl font-black tracking-tight flex items-center gap-3 italic">
                                <Activity className="text-primary" /> System Heartbeat
                            </h3>
                            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                                Latency: 24ms
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="p-6 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between group hover:border-primary/30 transition-colors">
                                <div className="flex items-center gap-6">
                                    <div className="size-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500">
                                        <Zap size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm">Agent Orchestrator</h4>
                                        <p className="text-xs text-muted-foreground">Worker process handling lifecycle events</p>
                                    </div>
                                </div>
                                <span className="px-4 py-1.5 rounded-full bg-green-500/10 text-green-500 text-[10px] font-black uppercase tracking-widest shadow-[0_0_15px_rgba(34,197,94,0.2)]">Healthy</span>
                            </div>

                            <div className="p-6 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between group hover:border-primary/30 transition-colors">
                                <div className="flex items-center gap-6">
                                    <div className="size-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                                        <Shield size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm">Neural Gateway</h4>
                                        <p className="text-xs text-muted-foreground">Auth and RLS enforcement layer</p>
                                    </div>
                                </div>
                                <span className="px-4 py-1.5 rounded-full bg-green-500/10 text-green-500 text-[10px] font-black uppercase tracking-widest shadow-[0_0_15px_rgba(34,197,94,0.2)]">Healthy</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="glass-card rounded-[3rem] p-10 border border-white/5 flex flex-col">
                        <h3 className="text-2xl font-black tracking-tight mb-8 italic">
                            Command Center
                        </h3>

                        <div className="space-y-4 flex-1">
                            <button
                                onClick={handleDeploySuperAgent}
                                disabled={isDeploying}
                                className={`w-full p-6 rounded-2xl border text-left transition-all group ${deploySuccess ? 'bg-green-500/10 border-green-500/50' : 'bg-primary/20 border-primary/30 hover:bg-primary/30'}`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <Terminal size={18} className={deploySuccess ? 'text-green-500' : 'text-primary'} />
                                        <span className={`font-black text-xs uppercase tracking-widest ${deploySuccess ? 'text-green-500' : ''}`}>
                                            {deploySuccess ? 'Super Agent Online' : 'Deploy Super Agent'}
                                        </span>
                                    </div>
                                    {isDeploying && <Loader2 size={16} className="animate-spin text-primary" />}
                                    {deploySuccess && <Activity size={16} className="text-green-500 animate-pulse" />}
                                </div>
                                <p className="text-[10px] text-muted-foreground font-medium">
                                    {deploySuccess ? 'Administrative intelligence active in root mode.' : 'Initialize root-level administrative intelligence.'}
                                </p>
                            </button>

                            <button className="w-full p-6 rounded-2xl bg-white/5 border border-white/5 text-left hover:bg-white/10 transition-all group">
                                <div className="flex items-center gap-3 mb-2">
                                    <Users size={18} className="text-muted-foreground group-hover:text-white transition-colors" />
                                    <span className="font-black text-xs uppercase tracking-widest">Audit Permissions</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground font-medium">Review and modify user security tiers.</p>
                            </button>
                        </div>

                        <div className="mt-8 p-6 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive">
                            <div className="flex items-center gap-3 mb-2">
                                <AlertTriangle size={18} />
                                <span className="font-black text-xs uppercase tracking-widest">Panic Protocol</span>
                            </div>
                            <button className="w-full py-2 bg-destructive text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity">
                                Emergency Stop All Agents
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
