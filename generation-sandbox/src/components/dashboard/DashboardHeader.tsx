'use client';

import Link from 'next/link';
import UserAvatar from '@/components/UserAvatar';
import NotificationBell from '@/components/NotificationBell';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Icons } from '@/components/ui/Icons';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { SuiteSwitcher } from '@/components/SuiteSwitcher';

interface DashboardHeaderProps {
    user: any;
    profile: any;
    credits: any;
    effectiveRole: string;
    availableCredits: number;
    isAdminOrSu: boolean;
    switchRole: (role: any) => void;
    setAudienceMode: (mode: 'casual' | 'professional') => void;
    signOut: () => void;
}

export default function DashboardHeader({
    user,
    profile,
    availableCredits,
    isAdminOrSu,
    effectiveRole,
    switchRole,
    setAudienceMode,
    signOut
}: DashboardHeaderProps) {
    return (
        <Card variant="glass" className="sticky top-0 z-50 border-x-0 border-t-0 rounded-none border-b border-border shadow-sm h-[72px] flex items-center">
            <div className="max-w-7xl w-full mx-auto px-4 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <Link href="/dashboard" className="flex items-center gap-3 group">
                        <div className="w-10 h-10 rounded-xl bg-brand-gradient p-[1px]">
                            <div className="w-full h-full bg-black rounded-xl flex items-center justify-center">
                                <Icons.zap className="text-primary w-5 h-5 group-hover:scale-110 transition-transform" />
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg font-black uppercase tracking-tighter leading-none">Stillwater Studio</h1>
                                <span className="text-[9px] font-black bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded tracking-widest leading-none">v0.1.0</span>
                            </div>
                            <p className="text-[9px] font-black text-foreground-muted uppercase tracking-[0.2em] mt-1">Ecosystem Central</p>
                        </div>
                    </Link>
                    <SuiteSwitcher />
                </div>

                <div className="flex items-center gap-6">
                    <NotificationBell />

                    <Link href="/pricing">
                        <Badge
                            variant="gradient"
                            className="px-3 py-1.5 rounded-full hover:border-primary/50 transition-colors group cursor-pointer"
                        >
                            <Icons.plus className="group-hover:rotate-90 transition-transform text-primary mr-1.5" size={16} />
                            <span className="font-bold text-sm tracking-normal capitalize">{availableCredits} credits</span>
                            <span className="ml-1.5 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">Get More</span>
                        </Badge>
                    </Link>

                    <div className="flex items-center gap-3">
                        <Link href={`/profile/${user.uid}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                            <UserAvatar 
                                src={profile.photoURL} 
                                name={profile.displayName || profile.username} 
                                size="md"
                                className="border-2 border-primary shadow-sm"
                            />
                            <div className="hidden md:block">
                                <p className="text-sm font-bold leading-tight">{profile.displayName || 'Creator'}</p>
                                <p className="text-[10px] text-foreground-muted truncate max-w-[150px]">{user.email}</p>
                                <p className="text-[10px] text-primary/80 font-black uppercase tracking-tighter mt-0.5">{profile.subscription} plan</p>
                            </div>
                        </Link>
                        <Link href="/settings">
                            <Button variant="secondary" size="icon" className="w-10 h-10">
                                <Icons.settings size={18} />
                            </Button>
                        </Link>
                        <Button variant="secondary" size="icon" className="w-10 h-10" onClick={signOut} title="Sign Out">
                            <Icons.logout size={18} />
                        </Button>
                    </div>
                </div>
            </div>
        </Card>
    );
}
