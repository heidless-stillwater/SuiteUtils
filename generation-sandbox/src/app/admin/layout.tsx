'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/ui/Icons';

const ADMIN_NAV_ITEMS = [
    { name: 'Overview', href: '/admin', icon: '📊' },
    { name: 'Users', href: '/admin/users', icon: '👥' },
    { name: 'Moderation', href: '/admin/moderation', icon: '🛡️' },
    { name: 'Monitoring', href: '/admin/monitoring', icon: '🛠️' },
    { name: 'Settings', href: '/admin/settings', icon: '⚙️' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user, profile, loading, isAdmin } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!loading && (!user || !isAdmin)) {
            router.push('/dashboard');
        }
    }, [user, profile, loading, isAdmin, router]);

    if (loading || !user || !isAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Icons.spinner className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex bg-background selection:bg-primary/20">
            {/* Admin Sidebar */}
            <aside className="w-64 border-r border-border bg-background-secondary sticky top-0 h-screen flex flex-col z-20">
                <div className="p-8 border-b border-border">
                    <Link href="/dashboard" className="text-xl font-black gradient-text block tracking-tighter hover:opacity-80 transition-opacity">
                        AI STUDIO
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
                        <span className="text-[10px] uppercase tracking-widest font-black text-foreground-muted">Admin Console</span>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1.5 mt-4">
                    {ADMIN_NAV_ITEMS.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all group ${isActive
                                    ? 'bg-primary text-white shadow-lg shadow-primary/25 scale-[1.02]'
                                    : 'text-foreground-muted hover:text-foreground hover:bg-background-secondary'
                                    }`}
                            >
                                <span className={`text-xl transition-transform group-hover:scale-110 ${isActive ? 'scale-110' : ''}`}>
                                    {item.icon}
                                </span>
                                <span className="font-bold text-sm tracking-tight">{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-border">
                    <Link href="/dashboard" className="flex items-center gap-2 text-xs font-bold text-foreground-muted hover:text-primary p-3 rounded-xl hover:bg-primary/5 transition-all group">
                        <span className="group-hover:-translate-x-1 transition-transform">←</span>
                        <span>Back to Dashboard</span>
                    </Link>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 min-w-0 bg-background flex flex-col">
                <header className="h-16 border-b border-border bg-background-secondary/80 backdrop-blur-xl sticky top-0 z-10 flex items-center justify-between px-8">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground-muted uppercase tracking-widest">Admin</span>
                        <span className="text-border">/</span>
                        <h1 className="text-sm font-black uppercase tracking-widest">
                            {ADMIN_NAV_ITEMS.find(i => i.href === pathname)?.name || 'Dashboard'}
                        </h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <p className="text-xs font-black">{profile?.displayName}</p>
                            <p className="text-[9px] uppercase text-accent font-black tracking-widest">{profile?.role} SESSION</p>
                        </div>
                        {profile?.photoURL && (
                            <img
                                src={profile.photoURL}
                                alt="Admin"
                                className="w-8 h-8 rounded-full border-2 border-primary/20 bg-background-secondary object-cover"
                            />
                        )}
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-6xl mx-auto p-8">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}
