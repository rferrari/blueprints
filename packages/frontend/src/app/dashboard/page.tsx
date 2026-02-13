'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, ShoppingBag, Settings, LogOut, Bot, Sparkles, Zap, ChevronRight, Menu, X, Plus, Loader2, Trash2, Check, Shield, MessageSquare } from 'lucide-react';
import ProjectView from '@/components/project-view';
import Marketplace from '@/components/marketplace';
import ConfirmationModal from '@/components/confirmation-modal';
import SettingsView from '@/components/settings-view';
import UpgradeModal from '@/components/upgrade-modal';
import FeedbackView from '@/components/feedback-view';

const CLUSTER_FIRST = [
    // Tactical / Ops
    'Command', 'Ops', 'Mission', 'Signal', 'Execution', 'Control', 'Field', 'Strategic',
    // Agent / Sci-Fi
    'Neuron', 'Synthetic', 'Ghost', 'Quantum', 'Cyber', 'Autonomy', 'Protocol', 'Sentinel',
    // Startup / Hacker
    'Growth', 'Velocity', 'Chaos', 'Bootstrap', 'Launch', 'Build',
    // Product / Business
    'Revenue', 'Market', 'Customer', 'Insights', 'Product', 'Deal', 'Analytics', 'Retention',
    // Fun / Unhinged
    'Brain', 'Idea', 'Agent', 'Think', 'Digital', 'Automation'
];

const CLUSTER_LAST = [
    // Tactical / Ops
    'Core', 'Hub', 'Control', 'Room', 'Bay', 'Deck', 'Ops', 'Cell',
    // Agent / Sci-Fi
    'Cluster', 'Wing', 'Network', 'Division', 'Grid', 'Vault', 'Node',
    // Startup / Hacker
    'Lab', 'Shipyard', 'Launchpad', 'Den', 'Stack',
    // Product / Business
    'Engine', 'Radar', 'Forge', 'Factory', 'Studio', 'Desk', 'Hive', 'Unit',
    // Fun / Slightly Unhinged
    'Farm', 'Reactor', 'Swarm', 'Nursery', 'Coven', 'Pit'
];

const pickRandom = (arr: string[]) =>
    arr[Math.floor(Math.random() * arr.length)];

const generateClusterName = () =>
    `${pickRandom(CLUSTER_FIRST)} ${pickRandom(CLUSTER_LAST)}`;

// Optional: prevent repeats like "Ops Ops"
// const generateClusterName = () => {
//     let first, last;

//     do {
//         first = pickRandom(CLUSTER_FIRST);
//         last = pickRandom(CLUSTER_LAST);
//     } while (first === last);

//     return `${first} ${last}`;
// };



export default function DashboardPage() {
    const [user, setUser] = useState<any>(null);
    const [role, setRole] = useState<string | null>(null);
    const [view, setView] = useState<'projects' | 'marketplace' | 'settings' | 'feedback'>('projects');
    const [selectedProject, setSelectedProject] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Default closed for mobile
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();
    const router = useRouter();

    const [isBackendOnline, setIsBackendOnline] = useState(true);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    const checkBackendHealth = async () => {
        try {
            const res = await fetch(`${API_URL}/health`);
            setIsBackendOnline(res.ok);
        } catch (error) {
            setIsBackendOnline(false);
        }
    };

    useEffect(() => {
        checkBackendHealth();
        const interval = setInterval(checkBackendHealth, 60000); // Check every 60s
        return () => clearInterval(interval);
    }, [API_URL]);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/login');
                return;
            }
            setUser(session.user);

            // Fetch profile/role
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', session.user.id)
                .single();

            setRole(profile?.role || 'user');
            fetchProjects(session.access_token);
        };
        checkUser();
    }, [router, supabase]);

    const fetchProjects = async (token: string) => {
        try {
            const res = await fetch(`${API_URL}/projects`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setProjects(data);
            }
        } finally {
            setLoading(false);
        }
    };

    const updateProjectAgentCount = (projectId: string, delta: number) => {
        setProjects(prev => prev.map(p =>
            p.id === projectId
                ? { ...p, agentCount: Math.max(0, (p.agentCount || 0) + delta) }
                : p
        ));
    };

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [selectedFramework, setSelectedFramework] = useState<'eliza' | 'openclaw' | 'mixed'>('mixed');
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; projectId: string | null }>({
        isOpen: false,
        projectId: null
    });
    const [isDeleting, setIsDeleting] = useState(false);

    // Upgrade Modal State
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

    const [clusterHint, setClusterHint] = useState('e.g. Sales Unit B');
    useEffect(() => {
        const hint = generateClusterName();
        setClusterHint(`e.g. ${hint}`);
        if (isCreateModalOpen) {
            setNewProjectName(hint);
        }
    }, [isCreateModalOpen]); // Update hint when modal opens

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProjectName.trim() || !user) return;

        setIsCreating(true);
        setCreateError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${API_URL}/projects`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({ name: newProjectName })
            });

            if (res.ok) {
                const newProject = await res.json();
                setProjects(prev => [...prev, newProject]);
                setIsCreateModalOpen(false);
                setNewProjectName('');
                // Auto-navigate to new cluster
                setSelectedProject(newProject.id);
            } else {
                const errData = await res.json();
                setCreateError(errData.message || 'Initialization failed. Check backend RLS configuration.');
            }
        } catch (err: any) {
            console.error('Failed to create project:', err);
            setCreateError(err.message || 'System error. Cluster synchronization failed.');
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteProject = async (projectId: string) => {
        setDeleteModal({ isOpen: true, projectId });
    };

    const confirmDeleteProject = async () => {
        const projectId = deleteModal.projectId;
        if (!projectId || !user) return;

        setIsDeleting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${API_URL}/projects/${projectId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`
                }
            });

            if (res.ok) {
                setProjects(prev => prev.filter(p => p.id !== projectId));
                setSelectedProject(null);
                setDeleteModal({ isOpen: false, projectId: null });
            } else {
                const errData = await res.json().catch(() => ({}));
                alert(errData.message || 'Failed to delete cluster');
            }
        } catch (err: any) {
            console.error('Failed to delete project:', err);
            alert('System error. Failed to delete cluster.');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    const NavItem = ({ icon: Icon, label, id, color }: any) => (
        <button
            onClick={() => {
                setView(id);
                setSelectedProject(null);
                setIsSidebarOpen(false); // Close sidebar on mobile navigation
            }}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden ${view === id && !selectedProject
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-white hover:bg-white/5'
                }`}
        >
            {view === id && !selectedProject && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
            )}
            <div className={`p-2 rounded-xl transition-colors ${view === id && !selectedProject ? 'bg-primary/20' : 'group-hover:bg-white/10'}`}>
                <Icon size={20} className={view === id && !selectedProject ? 'text-primary' : ''} />
            </div>
            <span className="font-bold tracking-tight text-sm">{label}</span>
            <ChevronRight size={14} className={`ml-auto transition-transform duration-300 ${view === id && !selectedProject ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`} />
        </button>
    );

    return (
        <div className="flex min-h-screen bg-transparent">
            {/* Sidebar */}
            <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-72 glass border-r border-white/5 transition-transform duration-500 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                <div className="flex flex-col h-full p-6">
                    <Link href="/dashboard" className="flex items-center gap-3 mb-12 px-2 hover:opacity-80 transition-opacity">
                        <div className="size-10 rounded-xl bg-gradient-unicorn p-0.5 shadow-lg shadow-primary/20">
                            <div className="w-full h-full bg-background rounded-[calc(0.75rem-2px)] flex items-center justify-center">
                                <Bot size={20} className="text-white" />
                            </div>
                        </div>
                        <h1 className="text-xl font-black tracking-tighter">BLUE<span className="text-primary">PRINTS</span></h1>
                    </Link>

                    <div className="space-y-2 flex-1">
                        <div className="px-4 mb-4">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Main Menu</span>
                        </div>
                        <NavItem icon={LayoutDashboard} label="Dashboard" id="projects" />
                        <NavItem icon={ShoppingBag} label="Blueprints" id="marketplace" />

                        {(role === 'admin_read' || role === 'super_admin') && (
                            <Link
                                href="/admin"
                                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden text-muted-foreground hover:text-white hover:bg-primary/10 border border-transparent hover:border-primary/20"
                            >
                                <div className="p-2 rounded-xl transition-colors group-hover:bg-primary/20">
                                    <Shield size={20} className="text-primary" />
                                </div>
                                <span className="font-bold tracking-tight text-sm">Admin Console</span>
                                <ChevronRight size={14} className="ml-auto transition-transform duration-300 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0" />
                            </Link>
                        )}

                        <div className="px-4 pt-8 mb-4">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Infrastructure</span>
                        </div>
                        <NavItem icon={Settings} label="Settings" id="settings" />
                        <div className="relative">
                            <NavItem icon={MessageSquare} label="Feedback" id="feedback" />
                            <div className="absolute top-3.5 right-10 pointer-events-none">
                                <span className="px-1.5 py-0.5 rounded-md bg-primary/20 text-primary text-[8px] font-black uppercase tracking-widest border border-primary/30">Beta</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto space-y-4">
                        <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/5 border border-white/5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:rotate-12 transition-transform">
                                <Zap size={40} className="text-primary" />
                            </div>
                            <p className="text-xs font-bold text-white mb-1">Unicorn Plan</p>
                            <p className="text-[10px] text-muted-foreground mb-3 font-medium">Unlock Unlimited Agents</p>
                            <button
                                onClick={() => setIsUpgradeModalOpen(true)}
                                className="w-full py-2 bg-primary hover:bg-primary/90 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors shadow-lg shadow-primary/20"
                            >
                                Upgrade
                            </button>
                        </div>

                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-5 py-4 text-muted-foreground hover:text-destructive transition-colors group"
                        >
                            <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
                            <span className="font-bold text-sm tracking-tight">Disconnect</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
                {/* Header */}
                <header className="h-20 flex items-center justify-between px-8 border-b border-white/5 bg-transparent backdrop-blur-sm sticky top-0 z-30">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="lg:hidden p-2 hover:bg-white/5 rounded-xl">
                            <Menu size={20} />
                        </button>
                        <h2 className="text-xl font-black tracking-tight flex items-center gap-3">
                            {view === 'projects' && (selectedProject ? 'Cluster Overview' : 'Agents Cluster')}
                            {view === 'marketplace' && 'Agents Blueprints'}
                            {view === 'settings' && 'System Parameters'}
                            {view === 'feedback' && 'Neural Feedback'}
                            <Sparkles size={16} className="text-amber-400 animate-pulse" />
                        </h2>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className={`hidden md:flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-white/5 ${!isBackendOnline ? 'border-destructive/30' : ''}`}>
                            <div className={`size-2 rounded-full animate-pulse ${isBackendOnline ? 'bg-green-500' : 'bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} />
                            <span className={`text-[10px] font-black uppercase tracking-widest ${isBackendOnline ? 'text-muted-foreground' : 'text-destructive'}`}>
                                Cluster: {isBackendOnline ? 'Online' : 'Offline'}
                            </span>
                        </div>
                        <button
                            onClick={() => {
                                setView('settings');
                                setSelectedProject(null);
                            }}
                            className="size-10 rounded-full border-2 border-primary/30 p-0.5 shadow-lg shadow-primary/10 hover:scale-105 active:scale-95 transition-transform"
                        >
                            <img
                                src={`https://avatar.vercel.sh/${user?.email}`}
                                className="w-full h-full rounded-full object-cover"
                                alt="User"
                            />
                        </button>
                    </div>
                </header>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div className="max-w-6xl mx-auto h-full">
                        {loading ? (
                            <div className="flex h-full items-center justify-center">
                                <div className="size-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                            </div>
                        ) : selectedProject ? (
                            (() => {
                                const currentProject = projects.find(p => p.id === selectedProject);
                                const hasAgents = (currentProject?.agentCount || 0) > 0;

                                return (
                                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div className="flex items-center justify-between mb-8">
                                            <button
                                                onClick={() => setSelectedProject(null)}
                                                className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-white flex items-center gap-2 group"
                                            >
                                                <ChevronRight size={14} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                                                Back to Clusters
                                            </button>
                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={() => handleDeleteProject(selectedProject)}
                                                    disabled={hasAgents}
                                                    title={hasAgents ? `Must remove ${currentProject.agentCount} active agent${currentProject.agentCount === 1 ? '' : 's'} before deletion` : 'Delete Cluster'}
                                                    className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 group transition-all ${hasAgents
                                                        ? 'text-muted-foreground/30 cursor-not-allowed opacity-50'
                                                        : 'text-muted-foreground hover:text-destructive'
                                                        }`}
                                                >
                                                    <Trash2 size={14} />
                                                    Delete Cluster
                                                </button>
                                            </div>
                                        </div>
                                        <ProjectView
                                            projectId={selectedProject}
                                            onDataChange={async () => {
                                                const { data: { session } } = await supabase.auth.getSession();
                                                if (session?.access_token) {
                                                    // Immediate refresh to update counts
                                                    await fetchProjects(session.access_token);
                                                }
                                            }}
                                            onUpgrade={() => setIsUpgradeModalOpen(true)}
                                        />
                                    </div>
                                );
                            })()
                        ) : view === 'projects' ? (
                            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <h3 className="text-3xl font-black tracking-tighter mb-2">Clusters</h3>
                                        <p className="text-muted-foreground font-medium">Orchestrate your autonomous agent clusters.</p>
                                    </div>
                                    <button
                                        onClick={() => setIsCreateModalOpen(true)}
                                        className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/90 transition-all active:scale-95 shadow-xl"
                                    >
                                        <Plus size={16} /> New Cluster
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {projects.map((project: any) => (
                                        <button
                                            key={project.id}
                                            onClick={() => setSelectedProject(project.id)}
                                            className="group glass-card rounded-3xl p-6 text-left relative overflow-hidden active:scale-[0.98]"
                                        >
                                            <div className="absolute -bottom-10 -right-10 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                                <Bot size={80} />
                                            </div>
                                            <div className="flex items-start justify-between mb-8">
                                                <div className="size-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                                    <LayoutDashboard size={24} className="group-hover:text-primary transition-colors" />
                                                </div>
                                                <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full border border-current ${(project.tier || 'free') === 'free' ? 'text-muted-foreground' : 'text-primary'
                                                    }`}>
                                                    {project.tier || 'free'}
                                                </span>
                                            </div>
                                            <h4 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{project.name}</h4>
                                            <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground">
                                                <span className="flex items-center gap-1.5">
                                                    <Bot size={14} /> {project.agentCount || 0} {project.agentCount === 1 ? 'Agent' : 'Agents'}
                                                </span>
                                                <span className="flex items-center gap-1.5 hover:text-white transition-colors">
                                                    Manage Cluster <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : view === 'marketplace' ? (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <Marketplace projectId={selectedProject || 'default'} />
                            </div>
                        ) : view === 'feedback' ? (
                            <FeedbackView />
                        ) : (
                            <div className="h-full">
                                <SettingsView user={user} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Create Project Modal */}
                {isCreateModalOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-300">
                        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl" onClick={() => setIsCreateModalOpen(false)} />
                        {/* ... existing Initialize Cluster modal code ... */}
                        <div className="relative w-full max-w-lg glass-card rounded-[3rem] p-8 md:p-12 shadow-2xl border-white/5 bg-white/[0.02] animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
                            {/* Re-inserting the content efficiently would require a larger replace, simpler to let it be handled by existing code or just ensure I don't break it. 
                                Actually, I am inside the replace block for the modal. I should just append my new modal.
                             */}
                            <div className="flex flex-col items-center text-center mb-10">
                                <div className="size-16 rounded-2xl bg-gradient-unicorn p-0.5 shadow-lg shadow-primary/20 mb-6 group animate-glow">
                                    <div className="w-full h-full bg-background rounded-[calc(1rem-2px)] flex items-center justify-center">
                                        <Plus size={32} className="text-white group-hover:scale-110 transition-transform duration-300" />
                                    </div>
                                </div>
                                <h2 className="text-3xl font-black tracking-tighter mb-2">Initialize New Cluster</h2>
                                <p className="text-muted-foreground font-medium text-sm">Orchestrate a new set of autonomous agents.</p>
                            </div>

                            <form onSubmit={handleCreateProject} className="space-y-6">
                                <div className="group">
                                    <label className="block text-sm font-bold text-muted-foreground mb-2 ml-1 uppercase tracking-widest transition-colors group-focus-within:text-primary">
                                        Cluster Designation
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={newProjectName}
                                        onChange={(e) => {
                                            setNewProjectName(e.target.value);
                                            setCreateError(null);
                                        }}
                                        placeholder={clusterHint}
                                        className="w-full rounded-2xl border border-white/5 bg-white/5 px-6 py-4 focus:border-primary/50 focus:bg-white/[0.08] outline-none transition-all duration-300 placeholder:text-muted-foreground/30 font-bold"
                                        autoFocus
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="block text-sm font-bold text-muted-foreground ml-1 uppercase tracking-widest transition-colors group-focus-within:text-primary">
                                        Agent Framework
                                    </label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            { id: 'eliza', name: 'Eliza', icon: Bot, desc: 'Character agents' },
                                            { id: 'openclaw', name: 'OpenClaw', icon: Sparkles, desc: 'Collective Intel' },
                                            { id: 'mixed', name: 'Mixed', icon: Zap, desc: 'Frameworks' }
                                        ].map((fw) => (
                                            <button
                                                key={fw.id}
                                                type="button"
                                                onClick={() => setSelectedFramework(fw.id as any)}
                                                className={`p-4 rounded-2xl border transition-all text-left relative overflow-hidden group ${selectedFramework === fw.id
                                                    ? 'border-primary bg-primary/10 shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)]'
                                                    : 'border-white/5 bg-white/5 hover:border-white/20 hover:bg-white/[0.08]'
                                                    }`}
                                            >
                                                <fw.icon size={18} className={`mb-2 ${selectedFramework === fw.id ? 'text-primary' : 'text-muted-foreground'}`} />
                                                <div className="font-black text-[10px] uppercase tracking-wider mb-0.5">{fw.name}</div>
                                                <div className="text-[10px] text-muted-foreground leading-tight font-medium">{fw.desc}</div>
                                                {selectedFramework === fw.id && (
                                                    <div className="absolute top-2 right-2 size-1.5 rounded-full bg-primary animate-pulse" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {createError && (
                                    <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-300">
                                        {createError}
                                    </div>
                                )}

                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsCreateModalOpen(false);
                                            setCreateError(null);
                                        }}
                                        className="flex-1 px-8 py-4 glass border border-white/10 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/5 transition-all active:scale-95"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isCreating || !newProjectName.trim()}
                                        className="flex-[2] px-8 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-primary/90 transition-all active:scale-95 shadow-xl shadow-primary/20 disabled:opacity-50 group overflow-hidden relative"
                                    >
                                        <div className="absolute inset-0 bg-gradient-unicorn opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <span className="relative flex items-center justify-center gap-2">
                                            {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                                            {isCreating ? 'Initializing...' : 'Initialize Cluster'}
                                        </span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                <ConfirmationModal
                    isOpen={deleteModal.isOpen}
                    onClose={() => setDeleteModal({ isOpen: false, projectId: null })}
                    onConfirm={confirmDeleteProject}
                    title="Delete Cluster?"
                    message="This action is irreversible. All agents and data within this cluster will be permanently destroyed."
                    confirmText="Delete Cluster"
                    isLoading={isDeleting}
                    type="danger"
                />

                {/* Upgrade Modal */}
                <UpgradeModal
                    isOpen={isUpgradeModalOpen}
                    onClose={() => setIsUpgradeModalOpen(false)}
                />
            </main>
        </div>
    );
}
