import { AlertTriangle, X, Loader2 } from 'lucide-react';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isLoading?: boolean;
    type?: 'danger' | 'warning' | 'info';
}

export default function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isLoading = false,
    type = 'danger'
}: ConfirmationModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl" onClick={isLoading ? undefined : onClose} />
            <div className={`relative w-full max-w-md glass-card rounded-[2.5rem] p-8 shadow-2xl border-white/5 bg-white/[0.02] animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 ${type === 'danger' ? 'shadow-[0_0_50px_-12px_rgba(239,68,68,0.3)]' : ''
                }`}>

                <div className="flex flex-col items-center text-center mb-8">
                    <div className={`size-16 rounded-2xl p-0.5 shadow-lg mb-6 group animate-glow ${type === 'danger' ? 'bg-gradient-to-br from-red-500 to-orange-500 shadow-red-500/20' : 'bg-gradient-unicorn shadow-primary/20'
                        }`}>
                        <div className="w-full h-full bg-background rounded-[calc(1rem-2px)] flex items-center justify-center">
                            <AlertTriangle size={32} className={`${type === 'danger' ? 'text-red-500' : 'text-primary'} group-hover:scale-110 transition-transform duration-300`} />
                        </div>
                    </div>
                    <h2 className="text-2xl font-black tracking-tighter mb-2">{title}</h2>
                    <p className="text-muted-foreground font-medium text-sm leading-relaxed">{message}</p>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 px-6 py-4 glass border border-white/10 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/5 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`flex-[1.5] px-6 py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-xl disabled:opacity-50 group overflow-hidden relative ${type === 'danger'
                                ? 'bg-destructive hover:bg-destructive/90 shadow-destructive/20'
                                : 'bg-primary hover:bg-primary/90 shadow-primary/20'
                            }`}
                    >
                        <span className="relative flex items-center justify-center gap-2">
                            {isLoading && <Loader2 size={14} className="animate-spin" />}
                            {confirmText}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
}
