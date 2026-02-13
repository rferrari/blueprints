'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import {
    LayoutDashboard, Users, Bot, Zap, Shield,
    ArrowLeft, Loader2, RefreshCw, AlertTriangle,
    TrendingUp, Activity, Terminal, MessageSquare, Star,
    CreditCard, Wallet, Clock, Rocket, BarChart3, X, LifeBuoy
} from 'lucide-react';
import Link from 'next/link';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import ManagedKeysAdmin from '@/components/managed-keys-admin';

export default function AdminDashboard() {
    const [user, setUser] = useState<any>(null);
    const [stats, setStats] = useState<any>(null);
    const [feedbacks, setFeedbacks] = useState<any[]>([]);
    const [upgradeFeedbacks, setUpgradeFeedbacks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDeploying, setIsDeploying] = useState(false);
    const [deploySuccess, setDeploySuccess] = useState(false);
    const [modalOpen, setModalOpen] = useState<string | null>(null);
    const [modalData, setModalData] = useState<any[]>([]);
    const [modalLoading, setModalLoading] = useState(false);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editingTier, setEditingTier] = useState<string>('free');
    const [allAgents, setAllAgents] = useState<any[]>([]);
    const [supportAgentId, setSupportAgentId] = useState<string | null>(null);
    const [isSavingSupport, setIsSavingSupport] = useState(false);
    const supabase = createClient();
    const router = useRouter();

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    const fetchStats = async (token: string) => {
        try {
            const timestamp = Date.now();
            console.log(`AdminDashboard: Fetching stats (ts: ${timestamp})...`);

            const res = await fetch(`${API_URL}/admin/stats?t=${timestamp}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) {
                if (res.status === 403) throw new Error('Administrative access denied');
                throw new Error('Failed to fetch system stats');
            }
            const data = await res.json();
            console.log('AdminDashboard: Stats received ->', data);
            setStats(data);

            const fRes = await fetch(`${API_URL}/admin/feedback?t=${timestamp}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (fRes.ok) {
                setFeedbacks(await fRes.json());
            }

            const uRes = await fetch(`${API_URL}/admin/upgrade-feedback?t=${timestamp}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (uRes.ok) {
                setUpgradeFeedbacks(await uRes.json());
            }

            // Fetch Support Agent Assignment
            const sRes = await fetch(`${API_URL}/admin/support-agent`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (sRes.ok) {
                const sData = await sRes.json();
                setSupportAgentId(sData.agent_id);
            }

            // Fetch All Agents for dropdown
            const aRes = await fetch(`${API_URL}/admin/agents`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (aRes.ok) {
                setAllAgents(await aRes.json());
            }
        } catch (err: any) {
            console.error('AdminDashboard Error:', err);
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

    const handleSaveSupportAgent = async (agentId: string) => {
        setIsSavingSupport(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${API_URL}/admin/support-agent`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ agent_id: agentId })
            });

            if (res.ok) {
                setSupportAgentId(agentId);
                alert('Support Agent assigned successfully.');
            }
        } catch (err) {
            console.error('Failed to save support agent:', err);
        } finally {
            setIsSavingSupport(false);
        }
    };

    const handleUpdateUserTier = async (userId: string, newTier: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch(`${API_URL}/admin/users/${userId}/tier`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ tier: newTier })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || 'Failed to update user tier');
            }

            // Refresh modal data
            if (modalOpen === 'users') {
                openModal('users');
            }
            setEditingUserId(null);
        } catch (err: any) {
            console.error('Failed to update user tier:', err);
            alert(err.message || 'Failed to update user tier');
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

    const openModal = async (type: string) => {
        setModalOpen(type);
        setModalLoading(true);
        setModalData([]);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) return;

            const res = await fetch(`${API_URL}/admin/${type}`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setModalData(data);
            }
        } catch (err) {
            console.error('Failed to fetch modal data:', err);
        } finally {
            setModalLoading(false);
        }
    };

    const StatCard = ({ title, value, icon: Icon, color, onClick }: any) => (
        <div
            onClick={onClick}
            className="glass-card rounded-[2rem] p-8 border border-white/5 relative overflow-hidden group cursor-pointer hover:border-white/20 transition-all"
        >
            <div className={`absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
                <Icon size={80} />
            </div>
            <div className="flex items-center gap-4 mb-4">
                <div className={`p-3 rounded-2xl bg-white/5 ${color}`}>
                    <Icon size={24} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</span>
            </div>
            <h4 className="text-4xl font-black tracking-tighter">{value}</h4>
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
                            <h1 className="text-4xl font-black tracking-tighter uppercase">Architect's<span className="text-primary">Room</span></h1>
                        </div>
                        <p className="text-muted-foreground font-medium ml-12">Global system oversight and autonomous agent control.</p>
                    </div>

                    <div className="flex items-center gap-4 ml-12 md:ml-0">
                        <button
                            onClick={async () => {
                                const { data: { session } } = await supabase.auth.getSession();
                                if (session?.access_token) {
                                    setLoading(true);
                                    fetchStats(session.access_token);
                                }
                            }}
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
                    <StatCard title="Total Users" value={stats?.users} icon={Users} color="text-blue-400" onClick={() => openModal('users')} />
                    <StatCard title="Total Agents" value={stats?.agents} icon={Bot} color="text-primary" onClick={() => openModal('agents')} />
                    <StatCard title="Active Clusters" value={stats?.projects} icon={LayoutDashboard} color="text-purple-400" onClick={() => openModal('clusters')} />
                    <StatCard title="Upgrade Wave" value={stats?.upgradeCount} icon={Rocket} color="text-green-400" onClick={() => openModal('upgrades')} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                    {/* System Monitoring */}
                    <div className="lg:col-span-2 glass-card rounded-[3rem] p-10 border border-white/5">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-2xl font-black tracking-tight flex items-center gap-3 italic">
                                <Activity className="text-primary" size={24} /> System Heartbeat
                            </h3>
                            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Latency: 24ms</div>
                        </div>

                        <div className="space-y-6 text-white">
                            <div className="p-6 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between hover:border-primary/30 transition-colors cursor-default">
                                <div className="flex items-center gap-6">
                                    <div className="size-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500"><Zap size={24} /></div>
                                    <div>
                                        <h4 className="font-bold text-sm">Agent Orchestrator</h4>
                                        <p className="text-xs text-muted-foreground">Worker process handling lifecycle events</p>
                                    </div>
                                </div>
                                <span className="px-4 py-1.5 rounded-full bg-green-500/10 text-green-500 text-[10px] font-black uppercase tracking-widest">Healthy</span>
                            </div>

                            <div className="p-6 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between hover:border-primary/30 transition-colors cursor-default">
                                <div className="flex items-center gap-6">
                                    <div className="size-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500"><Shield size={24} /></div>
                                    <div>
                                        <h4 className="font-bold text-sm">Neural Gateway</h4>
                                        <p className="text-xs text-muted-foreground">Auth and RLS enforcement layer</p>
                                    </div>
                                </div>
                                <span className="px-4 py-1.5 rounded-full bg-green-500/10 text-green-500 text-[10px] font-black uppercase tracking-widest">Healthy</span>
                            </div>
                        </div>
                    </div>

                    {/* Command Center */}
                    <div className="glass-card rounded-[3rem] p-10 border border-white/5 flex flex-col">
                        <h3 className="text-2xl font-black tracking-tight mb-8 italic">Command Center</h3>
                        <div className="space-y-4 flex-1 text-white">
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
                                </div>
                                <p className="text-[10px] text-muted-foreground font-medium">Initialize root-level administrative intelligence.</p>
                            </button>
                            <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-4">
                                <div className="flex items-center gap-3">
                                    <LifeBuoy size={18} className="text-amber-400" />
                                    <span className="font-black text-xs uppercase tracking-widest text-white">Support Proxy</span>
                                </div>
                                <div className="flex gap-2">
                                    <select
                                        className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs font-bold text-white outline-none focus:border-primary/50 transition-colors"
                                        value={supportAgentId || ''}
                                        onChange={(e) => handleSaveSupportAgent(e.target.value)}
                                        disabled={isSavingSupport}
                                    >
                                        <option value="" disabled>Select Support Agent</option>
                                        {allAgents.map(a => (
                                            <option key={a.id} value={a.id}>{a.name} ({a.framework})</option>
                                        ))}
                                    </select>
                                    {isSavingSupport && <Loader2 size={16} className="animate-spin self-center" />}
                                </div>
                                <p className="text-[10px] text-muted-foreground font-medium">Designate an official agent for user support transmissions.</p>
                            </div>

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
                                <AlertTriangle size={18} /><span className="font-black text-xs uppercase tracking-widest">Panic Protocol</span>
                            </div>
                            <button className="w-full py-2 bg-destructive text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity">Emergency Stop All Agents</button>
                        </div>
                    </div>
                </div>

                {/* Section 1.5: Managed Provider Keys */}
                <div className="glass-card rounded-[3rem] p-10 border border-white/5 mb-8">
                    <ManagedKeysAdmin />
                </div>

                {/* Section 2: Leaderboards & Analytics */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-8">
                    {/* Payment Leaderboard */}
                    <div className="glass-card rounded-[3rem] p-10 border border-white/5">
                        <h3 className="text-xl font-black tracking-tight flex items-center gap-3 italic mb-8 uppercase text-blue-400">
                            <BarChart3 size={20} /> Payment Rank
                        </h3>
                        <div className="space-y-4">
                            {Object.entries(stats?.paymentStats || {}).sort((a: any, b: any) => b[1] - a[1]).map(([method, count], i) => (
                                <div key={method} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 group hover:border-blue-400/30 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <span className={`text-xs font-black ${i === 0 ? 'text-amber-400' : 'text-muted-foreground'}`}>#0{i + 1}</span>
                                        <span className="text-xs font-bold text-white uppercase tracking-widest">{method}</span>
                                    </div>
                                    <span className="text-xs font-black text-blue-400">{count as number}</span>
                                </div>
                            ))}
                            {Object.keys(stats?.paymentStats || {}).length === 0 && (
                                <p className="text-[10px] text-muted-foreground italic text-center py-4">Waiting for transmissions...</p>
                            )}
                        </div>
                    </div>

                    {/* Sentiment Feed (Wider) */}
                    <div className="lg:col-span-3 glass-card rounded-[3rem] p-10 border border-white/5">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-2xl font-black tracking-tight flex items-center gap-3 italic uppercase text-amber-400">
                                <MessageSquare size={24} /> Sentiment Feed
                            </h3>
                            <div className="px-3 py-1 bg-amber-400/10 border border-amber-400/20 rounded-full text-[10px] font-black text-amber-500 uppercase tracking-widest">Grade: {stats?.averageRating || 0}/5</div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-4 custom-scrollbar">
                            {feedbacks.length === 0 ? (
                                <div className="col-span-full p-12 text-center text-muted-foreground border border-dashed border-white/5 rounded-3xl italic">No neural transmissions received yet.</div>
                            ) : (
                                feedbacks.map((f: any) => (
                                    <div key={f.id} className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs uppercase">{f.user?.email?.[0] || 'U'}</div>
                                                <div>
                                                    <p className="text-xs font-bold text-white uppercase">{f.user?.email || 'Anonymous'}</p>
                                                    <p className="text-[10px] text-muted-foreground">{new Date(f.created_at).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                {[1, 2, 3, 4, 5].map(s => (
                                                    <Star key={s} size={12} className={s <= f.rating ? 'text-amber-400 fill-amber-400' : 'text-white/10'} />
                                                ))}
                                            </div>
                                        </div>
                                        <p className="text-sm font-medium text-muted-foreground leading-relaxed italic">"{f.comment || 'No comment provided.'}"</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Section 3: Detailed Upgrade Logs */}
                <div className="glass-card rounded-[3rem] p-10 border border-white/5">
                    <h3 className="text-2xl font-black tracking-tight flex items-center gap-3 italic mb-8 uppercase text-green-400">
                        <Rocket size={24} /> Survey Archive
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[800px] overflow-y-auto pr-4 custom-scrollbar">
                        {upgradeFeedbacks.length === 0 ? (
                            <div className="col-span-full p-12 text-center text-muted-foreground border border-dashed border-white/5 rounded-3xl italic">No upgrade transmissions yet.</div>
                        ) : (
                            upgradeFeedbacks.map((u: any) => (
                                <div key={u.id} className="p-8 rounded-[2rem] bg-white/[0.02] border border-white/5 hover:border-green-400/20 transition-all group">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <p className="text-[10px] font-black text-white uppercase tracking-widest mb-1">{u.user?.email || 'Anonymous'}</p>
                                            <p className="text-[8px] text-muted-foreground font-mono italic">{new Date(u.created_at).toLocaleString()}</p>
                                        </div>
                                        <div className="px-3 py-1 rounded-lg bg-primary/10 border border-primary/20 text-[10px] font-black uppercase text-primary tracking-widest">{u.plan_selected}</div>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 mb-6 group-hover:bg-white/10 transition-colors">
                                        <p className="text-[8px] font-black uppercase text-muted-foreground tracking-[.2em] mb-2">Protocol Link</p>
                                        <div className="flex items-center gap-3">
                                            <div className="size-8 rounded-lg bg-green-400/10 flex items-center justify-center text-green-400 shadow-[0_0_10px_rgba(74,222,128,0.2)]">
                                                <Wallet size={16} />
                                            </div>
                                            <span className="text-xs font-black text-white px-2 tracking-widest">{u.payment_method?.toUpperCase()}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-3 mb-6">
                                        <p className="text-[8px] font-black uppercase text-muted-foreground tracking-[.2em]">Matrix Feedback</p>
                                        <div className="grid grid-cols-1 gap-1">
                                            {u.desired_plans?.map((dp: any, i: number) => dp.plan && (
                                                <div key={i} className="flex justify-between items-center p-2 rounded-lg hover:bg-white/5 transition-colors">
                                                    <span className="text-[10px] font-bold text-white/50">{dp.plan}</span>
                                                    <span className={`text-[9px] font-black uppercase tracking-widest ${dp.feedback === 'good' ? 'text-green-400 shadow-[0_0_5px_rgba(74,222,128,0.3)]' :
                                                        dp.feedback === 'high' ? 'text-destructive' : 'text-blue-400'
                                                        }`}>{dp.feedback}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="pt-6 border-t border-white/5">
                                        <div className="flex gap-1 mb-3">
                                            {[1, 2, 3, 4, 5].map(s => <Star key={s} size={12} className={s <= u.rating ? 'text-amber-400 fill-amber-400' : 'text-white/10'} />)}
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed italic">"{u.comments || 'No comment provided.'}"</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Data Modals */}
            <Dialog open={modalOpen !== null} onOpenChange={() => setModalOpen(null)}>
                <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto bg-black/95 border-white/10">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                            {modalOpen === 'users' && 'Total Users'}
                            {modalOpen === 'agents' && 'Total Agents'}
                            {modalOpen === 'clusters' && 'Active Clusters'}
                            {modalOpen === 'upgrades' && 'Upgrade Wave'}
                        </DialogTitle>
                    </DialogHeader>

                    {modalLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="size-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        {modalOpen === 'users' && (
                                            <>
                                                <th className="text-left p-3 font-black uppercase text-xs text-muted-foreground">Email</th>
                                                <th className="text-left p-3 font-black uppercase text-xs text-muted-foreground">Created</th>
                                                <th className="text-left p-3 font-black uppercase text-xs text-muted-foreground">Role</th>
                                                <th className="text-left p-3 font-black uppercase text-xs text-muted-foreground">Tier</th>
                                                <th className="text-left p-3 font-black uppercase text-xs text-muted-foreground">Actions</th>
                                            </>
                                        )}
                                        {modalOpen === 'agents' && (
                                            <>
                                                <th className="text-left p-3 font-black uppercase text-xs text-muted-foreground">Name</th>
                                                <th className="text-left p-3 font-black uppercase text-xs text-muted-foreground">Project</th>
                                                <th className="text-left p-3 font-black uppercase text-xs text-muted-foreground">Owner</th>
                                                <th className="text-left p-3 font-black uppercase text-xs text-muted-foreground">Status</th>
                                                <th className="text-left p-3 font-black uppercase text-xs text-muted-foreground">Created</th>
                                            </>
                                        )}
                                        {modalOpen === 'clusters' && (
                                            <>
                                                <th className="text-left p-3 font-black uppercase text-xs text-muted-foreground">Name</th>
                                                <th className="text-left p-3 font-black uppercase text-xs text-muted-foreground">Owner</th>
                                                <th className="text-left p-3 font-black uppercase text-xs text-muted-foreground">Agents (Active/Total)</th>
                                                <th className="text-left p-3 font-black uppercase text-xs text-muted-foreground">Created</th>
                                            </>
                                        )}
                                        {modalOpen === 'upgrades' && (
                                            <>
                                                <th className="text-left p-3 font-black uppercase text-xs text-muted-foreground">User</th>
                                                <th className="text-left p-3 font-black uppercase text-xs text-muted-foreground">Plan</th>
                                                <th className="text-left p-3 font-black uppercase text-xs text-muted-foreground">Payment</th>
                                                <th className="text-left p-3 font-black uppercase text-xs text-muted-foreground">Date</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {modalData.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="text-center py-8 text-muted-foreground italic">
                                                No data available
                                            </td>
                                        </tr>
                                    ) : (
                                        modalData.map((item: any, idx: number) => (
                                            <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                {modalOpen === 'users' && (
                                                    <>
                                                        <td className="p-3 font-medium">{item.email}</td>
                                                        <td className="p-3 text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</td>
                                                        <td className="p-3">
                                                            <span className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold uppercase">
                                                                {item.role || 'user'}
                                                            </span>
                                                        </td>
                                                        <td className="p-3">
                                                            {editingUserId === item.id ? (
                                                                <select
                                                                    value={editingTier}
                                                                    onChange={(e) => setEditingTier(e.target.value)}
                                                                    className="bg-black border border-white/20 rounded-lg px-3 py-1 text-xs font-bold uppercase outline-none focus:border-primary text-white"
                                                                >
                                                                    <option value="free" className="bg-black text-white">Free</option>
                                                                    <option value="pro" className="bg-black text-white">Pro</option>
                                                                    <option value="enterprise" className="bg-black text-white">Enterprise</option>
                                                                </select>
                                                            ) : (
                                                                <span className="px-2 py-1 rounded-lg bg-white/5 text-white text-xs font-bold uppercase">
                                                                    {item.tier || 'free'}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="p-3">
                                                            {editingUserId === item.id ? (
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={() => handleUpdateUserTier(item.id, editingTier)}
                                                                        className="px-3 py-1 bg-green-500/20 text-green-400 rounded-lg text-xs font-bold uppercase hover:bg-green-500/30 transition-colors"
                                                                    >
                                                                        Save
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setEditingUserId(null)}
                                                                        className="px-3 py-1 bg-white/5 text-muted-foreground rounded-lg text-xs font-bold uppercase hover:bg-white/10 transition-colors"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingUserId(item.id);
                                                                        setEditingTier(item.tier || 'free');
                                                                    }}
                                                                    className="px-3 py-1 bg-primary/20 text-primary rounded-lg text-xs font-bold uppercase hover:bg-primary/30 transition-colors"
                                                                >
                                                                    Edit Tier
                                                                </button>
                                                            )}
                                                        </td>
                                                    </>
                                                )}
                                                {modalOpen === 'agents' && (
                                                    <>
                                                        <td className="p-3 font-medium">{item.name}</td>
                                                        <td className="p-3 text-muted-foreground text-xs">{item.project_name}</td>
                                                        <td className="p-3 text-muted-foreground text-xs">{item.user_email}</td>
                                                        <td className="p-3">
                                                            <span className={`px-2 py-1 rounded-lg text-xs font-bold uppercase ${(item.status?.status || 'stopped') === 'running' ? 'bg-green-500/10 text-green-500' :
                                                                (item.status?.status || 'stopped') === 'stopped' ? 'bg-red-500/10 text-red-500' :
                                                                    'bg-yellow-500/10 text-yellow-500'
                                                                }`}>
                                                                {item.status?.status || 'stopped'}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</td>
                                                    </>
                                                )}
                                                {modalOpen === 'clusters' && (
                                                    <>
                                                        <td className="p-3 font-medium">{item.name}</td>
                                                        <td className="p-3 text-muted-foreground">{item.owner_email}</td>
                                                        <td className="p-3">
                                                            <span className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold">
                                                                {item.active_agents} / {item.total_agents}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</td>
                                                    </>
                                                )}
                                                {modalOpen === 'upgrades' && (
                                                    <>
                                                        <td className="p-3 font-medium">{item.user_email}</td>
                                                        <td className="p-3">
                                                            <span className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold uppercase">
                                                                {item.plan_selected}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-muted-foreground uppercase text-xs">{item.payment_method}</td>
                                                        <td className="p-3 text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</td>
                                                    </>
                                                )}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div >
    );
}
