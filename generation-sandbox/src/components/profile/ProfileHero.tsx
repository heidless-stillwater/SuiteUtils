'use client';

import Link from 'next/link';
import { Icons } from '@/components/ui/Icons';
import UserAvatar from '@/components/UserAvatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { UserProfile, BADGES } from '@/lib/types';

interface ProfileHeroProps {
    author: UserProfile;
    currentUser: any;
    isFollowing: boolean;
    followLoading: boolean;
    onToggleFollow: () => void;
    formatDate: (ts: any) => string;
    stats: {
        totalVotes: number;
        totalEntries: number;
    };
}

export default function ProfileHero({
    author,
    currentUser,
    isFollowing,
    followLoading,
    onToggleFollow,
    formatDate,
    stats
}: ProfileHeroProps) {
    return (
        <Card variant="glass" className="rounded-[2.5rem] mb-12 relative overflow-hidden border-white/5 bg-background-secondary/20 shadow-2xl">
            {/* Compact Header Stripe */}
            <div className={cn(
                "w-full relative h-2 bg-brand-gradient"
            )} />

            <div className="px-8 py-8 relative">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 blur-[100px] -mr-32 -mt-32 rounded-full pointer-events-none" />

                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                    {/* Primary Info */}
                    <div className="lg:col-span-7 flex flex-col md:flex-row items-center md:items-start gap-6">
                        <div className="relative group/avatar">
                            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-500" />
                            <UserAvatar 
                                src={author.photoURL} 
                                name={author.displayName || author.username} 
                                size="xl"
                                className="border-4 border-[#0f172a] shadow-2xl relative z-10"
                            />
                        </div>
                        
                        <div className="flex-1 text-center md:text-left pt-2">
                            <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-2 flex items-center justify-center md:justify-start gap-2">
                                Node Identity
                                <span className="w-1 h-1 rounded-full bg-primary/50" />
                                <span className="text-primary/60">node-{author.uid.slice(0, 8)}</span>
                            </div>

                            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white mb-2 leading-none capitalize">
                                {author.displayName || 'Anonymous'}
                            </h1>

                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-4">
                                {author.role === 'su' || author.role === 'admin' ? (
                                    <Badge variant="primary" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 font-black uppercase tracking-widest text-[8px] px-2 py-0.5">STAFF</Badge>
                                ) : (
                                    <Badge variant="primary" className="bg-primary/10 text-primary border-primary/20 font-black uppercase tracking-widest text-[8px] px-2 py-0.5">CREATOR</Badge>
                                )}
                                <div className="text-white/20 text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5">
                                    <Icons.history size={10} className="text-primary/40" />
                                    Since {formatDate(author.createdAt)}
                                </div>
                            </div>

                            {author.bio && (
                                <p className="text-white/40 text-sm italic border-l border-white/10 pl-4 mb-6 max-w-md line-clamp-2">
                                    &quot;{author.bio}&quot;
                                </p>
                            )}

                            <div className="flex items-center justify-center md:justify-start gap-4">
                                {currentUser?.uid === author.uid ? (
                                    <Link href="/settings">
                                        <Button variant="secondary" className="h-9 px-4 bg-white/5 border-white/5 text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-white/10 transition-all">
                                            Manage Node
                                            <Icons.settings size={12} />
                                        </Button>
                                    </Link>
                                ) : currentUser && (
                                    <Button
                                        onClick={onToggleFollow}
                                        disabled={followLoading}
                                        className={cn(
                                            "h-9 px-6 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl",
                                            isFollowing 
                                                ? "bg-white/5 border border-white/5 text-white/40" 
                                                : "bg-primary text-white shadow-primary/20"
                                        )}
                                    >
                                        {followLoading ? <Icons.spinner className="w-3 h-3 animate-spin" /> : isFollowing ? 'Connected' : 'Connect'}
                                        {!isFollowing && !followLoading && <Icons.plus size={12} />}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* HUD Stats - Elevated & Compact */}
                    <div className="lg:col-span-5 grid grid-cols-2 gap-2">
                        {[
                            { label: 'Fragments', value: stats.totalEntries, icon: <Icons.database size={12} /> },
                            { label: 'Resonance', value: stats.totalVotes, icon: <Icons.trophy size={12} /> },
                            { label: 'Network', value: author.followerCount || 0, icon: <Icons.users size={12} /> },
                            { label: 'Trust', value: (author.role === 'admin' || author.role === 'su') ? 'MAX' : 'HIGH', icon: <Icons.shield size={12} /> }
                        ].map((stat, i) => (
                            <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col items-center justify-center group/stat hover:bg-white/5 transition-all">
                                <div className="text-2xl font-black text-white tracking-tighter">{stat.value}</div>
                                <div className="text-[8px] font-black text-white/20 uppercase tracking-[0.3em] mt-1 flex items-center gap-1.5">
                                    <span className="text-primary/30 group-hover/stat:text-primary transition-colors">{stat.icon}</span>
                                    {stat.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </Card>
    );
}
