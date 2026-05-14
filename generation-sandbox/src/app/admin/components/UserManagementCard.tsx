'use client';

import { UserProfile, BADGES } from '@/lib/types';
import UserAvatar from '@/components/UserAvatar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

interface ExtendedUserProfile extends UserProfile {
    creditsBalance?: number;
}

interface UserManagementCardProps {
    user: ExtendedUserProfile;
    updatingUserId: string | null;
    onUpdateRole: (role: string) => void;
    onUpdateCredits: (amount: number) => void;
    onToggleBadge: (badgeId: string) => void;
}

export function UserManagementCard({
    user,
    updatingUserId,
    onUpdateRole,
    onUpdateCredits,
    onToggleBadge
}: UserManagementCardProps) {
    const isUpdating = updatingUserId === user.uid;

    return (
        <Card variant="glass" className="overflow-hidden group hover:border-primary/30 transition-all duration-300 rounded-3xl">
            <div className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                {/* Left: User Info */}
                <div className="flex items-center gap-5 min-w-[280px]">
                    <div className="relative">
                        <UserAvatar 
                            src={user.photoURL} 
                            name={user.displayName || user.username} 
                            size="lg"
                            className="border-2 border-border group-hover:border-primary/50 transition-colors"
                        />
                        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-background-secondary ${user.subscription === 'pro' ? 'bg-accent' : 'bg-primary'}`} />
                    </div>
                    <div>
                        <p className="text-lg font-black tracking-tight">{user.displayName}</p>
                        <p className="text-xs text-foreground-muted uppercase tracking-widest font-black">@{user.username}</p>
                        <p className="text-[10px] text-primary/60 font-medium mt-0.5 lowercase">{user.email}</p>
                        <div className="flex gap-2 mt-2">
                            <span className="badge badge-primary">
                                {user.role}
                            </span>
                            {user.subscription === 'pro' && (
                                <span className="badge badge-accent">
                                    PRO MEMBER
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Center: Badge Management */}
                <div className="flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-foreground-muted mb-3">Community Badges</p>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(BADGES).map(([id, badge]) => {
                            const isActive = (user.badges || []).includes(id);
                            return (
                                <button
                                    key={id}
                                    onClick={() => onToggleBadge(id)}
                                    disabled={isUpdating}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all border ${isActive
                                        ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                                        : 'bg-background hover:bg-background-secondary border-border text-foreground-muted opacity-60 hover:opacity-100'
                                        }`}
                                >
                                    <span className="text-xs">{badge.icon}</span>
                                    <span>{badge.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right: Controls */}
                <div className="flex flex-col sm:flex-row lg:flex-row items-stretch sm:items-center gap-4 border-t lg:border-t-0 lg:border-l border-border pt-6 lg:pt-0 lg:pl-10">
                    {/* Role Select */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-foreground-muted mb-1">System Role</label>
                        <Select
                            value={user.role}
                            onChange={(e) => onUpdateRole(e.target.value)}
                            disabled={isUpdating}
                            className="h-9 py-0 px-3 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                        >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                            <option value="su">Superuser</option>
                        </Select>
                    </div>

                    {/* Credit Adjust */}
                    <div className="flex flex-col gap-1 min-w-[140px]">
                        <label className="text-[10px] font-black uppercase tracking-widest text-foreground-muted mb-1">
                            Account: <span className="text-primary">{user.creditsBalance?.toLocaleString()} CR</span>
                        </label>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => onUpdateCredits(500)}
                                disabled={isUpdating}
                                className="flex-1 py-1 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 text-[10px] font-black uppercase"
                            >
                                +500
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                    const amount = prompt('Custom Credit Adjustment (use - for removal):');
                                    if (amount) onUpdateCredits(parseInt(amount));
                                }}
                                disabled={isUpdating}
                                className="flex-1 py-1 h-7 rounded-lg bg-background-secondary text-foreground-muted border border-border hover:text-foreground text-[10px] font-black uppercase"
                            >
                                Cust
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}
