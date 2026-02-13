'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { User, Lock, Save, Loader2, Mail, Sparkles } from 'lucide-react';
import { useNotification } from '@/components/notification-provider';
import UpgradeModal from './upgrade-modal';
import ApiKeyManager from './api-key-manager';

interface SettingsViewProps {
    user: {
        id: string;
        email?: string;
        user_metadata?: {
            full_name?: string;
        };
    };
}

export default function SettingsView({ user }: SettingsViewProps) {
    const { showNotification } = useNotification();
    const supabase = createClient();
    const [loading, setLoading] = useState(false);

    const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const updates: { data: { full_name: string }; password?: string } = {
            data: { full_name: fullName }
        };

        if (password) {
            if (password.length < 6) {
                showNotification('Password must be at least 6 characters.', 'error');
                setLoading(false);
                return;
            }
            if (password !== confirmPassword) {
                showNotification('Passwords do not match.', 'error');
                setLoading(false);
                return;
            }
            updates.password = password;
        }

        try {
            const { error } = await supabase.auth.updateUser(updates);

            if (error) {
                throw error;
            }

            showNotification('Profile updated successfully.', 'success');
            setPassword('');
            setConfirmPassword('');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to update profile.';
            showNotification(message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const [tier, setTier] = useState<string>('free');

    React.useEffect(() => {
        const fetchTier = async () => {
            const { data } = await supabase.from('profiles').select('tier').eq('id', user.id).single();
            if (data) setTier(data.tier);
        };
        fetchTier();
    }, [user.id, supabase]);



    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="glass-card rounded-[2.5rem] p-10 md:p-16 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-5">
                    <User size={120} />
                </div>

                <div className="relative z-10">
                    <div className="mb-10 flex items-center justify-between">
                        <div>
                            <h2 className="text-3xl font-black tracking-tight mb-2">Neural Identity</h2>
                            <p className="text-muted-foreground font-medium">Manage your personal credentials and access keys.</p>
                        </div>
                        <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest text-muted-foreground">
                            Current Tier: <span className="text-primary">{tier}</span>
                        </div>
                    </div>

                    <form onSubmit={handleUpdateProfile} className="space-y-8">
                        {/* Email (Read Only) */}
                        <div className="group opacity-60">
                            <label className="block text-sm font-bold text-muted-foreground mb-3 ml-1 uppercase tracking-widest">
                                Neural ID (Email)
                            </label>
                            <div className="relative">
                                <input
                                    type="email"
                                    value={user?.email || ''}
                                    disabled
                                    className="w-full bg-white/5 border border-dashed border-white/10 rounded-2xl py-5 pl-14 pr-6 outline-none font-mono text-sm cursor-not-allowed"
                                />
                                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                                <div className="absolute right-5 top-1/2 -translate-y-1/2 px-3 py-1 bg-white/10 rounded-lg text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                    Verified
                                </div>
                            </div>
                        </div>

                        {/* Full Name */}
                        <div className="group">
                            <label className="block text-sm font-bold text-muted-foreground mb-3 ml-1 uppercase tracking-widest transition-colors group-focus-within:text-primary">
                                Operator Name
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 pl-14 pr-6 outline-none focus:border-primary/50 focus:bg-white/[0.08] transition-all font-bold text-lg"
                                    placeholder="Enter your name"
                                />
                                <User className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={20} />
                            </div>
                        </div>

                        <div className="h-px bg-white/5 my-8" />

                        {/* Password Update */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 mb-2">
                                <Lock size={16} className="text-primary" />
                                <h3 className="text-sm font-black uppercase tracking-widest">Security Credentials</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="group">
                                    <label className="block text-[10px] font-bold text-muted-foreground mb-2 ml-1 uppercase tracking-widest">
                                        New Password
                                    </label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 outline-none focus:border-primary/50 focus:bg-white/[0.08] transition-all font-mono text-sm"
                                        placeholder="Min 6 chars"
                                    />
                                </div>
                                <div className="group">
                                    <label className="block text-[10px] font-bold text-muted-foreground mb-2 ml-1 uppercase tracking-widest">
                                        Confirm Password
                                    </label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 outline-none focus:border-primary/50 focus:bg-white/[0.08] transition-all font-mono text-sm"
                                        placeholder="Re-enter password"
                                    />
                                </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground font-medium italic bg-white/5 p-4 rounded-xl inline-block">
                                * Leave password fields empty if you do not wish to change it.
                            </p>
                        </div>

                        <div className="h-px bg-white/5 my-8" />

                        {/* Plan Information */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles size={16} className="text-primary" />
                                <h3 className="text-sm font-black uppercase tracking-widest">Current Plan</h3>
                            </div>
                            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Active Tier</div>
                                        <div className="text-2xl font-black text-primary capitalize">{tier}</div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsUpgradeModalOpen(true)}
                                        className="px-6 py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                                    >
                                        View Plans
                                    </button>
                                </div>
                                <p className="text-xs text-muted-foreground font-medium">
                                    Interested in upgrading? View available plans and join our waitlist.
                                </p>
                            </div>
                        </div>


                        <div className="pt-4 flex justify-end">
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-8 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all flex items-center gap-3 shadow-xl shadow-primary/20 disabled:opacity-50"
                            >
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                Update Identity
                            </button>
                        </div>
                    </form>
                </div>
            </div>


            {/* MCP API Keys */}
            <ApiKeyManager />

            {/* Upgrade Modal */}
            <UpgradeModal
                isOpen={isUpgradeModalOpen}
                onClose={() => setIsUpgradeModalOpen(false)}
                currentPlan={tier}
            />
        </div >
    );
}
