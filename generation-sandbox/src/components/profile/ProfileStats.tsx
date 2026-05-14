import { Icons } from '@/components/ui/Icons';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface ProfileStatsProps {
    influence: number;
    creations: number;
    followers: number;
    following: number;
    onStatClick?: (type: 'followers' | 'following') => void;
}

export default function ProfileStats({
    influence,
    creations,
    followers,
    following,
    onStatClick
}: ProfileStatsProps) {
    const stats = [
        { key: 'influence', label: 'Community Influence', value: influence, icon: <Icons.trophy className="text-primary" size={16} />, color: 'primary', clickable: false },
        { key: 'creations', label: 'Creations', value: creations, icon: <Icons.image className="text-foreground" size={16} />, color: 'foreground', clickable: false },
        { key: 'followers', label: 'Followers', value: followers, icon: <Icons.user className="text-foreground" size={16} />, color: 'foreground', clickable: true },
        { key: 'following', label: 'Following', value: following, icon: <Icons.following className="text-foreground" size={16} />, color: 'foreground', clickable: true },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
                <div
                    key={stat.label}
                    className={cn(
                        "flex items-center gap-4 group transition-all",
                        stat.clickable && "cursor-pointer hover:translate-y-[-2px]"
                    )}
                    onClick={() => stat.clickable && onStatClick?.(stat.key as any)}
                >
                    <div className={cn(
                        "p-4 rounded-2xl bg-white/[0.02] border border-white/5 transition-all shadow-sm",
                        stat.clickable ? "group-hover:border-primary/50 group-hover:bg-primary/10" : "group-hover:border-primary/30"
                    )}>
                        {stat.icon}
                    </div>
                    <div className="space-y-0.5">
                        <p className={cn(
                            "text-3xl font-black tracking-tighter transition-colors",
                            stat.color === 'primary' ? "text-primary" : "text-white",
                            stat.clickable && "group-hover:text-primary"
                        )}>
                            {stat.value}
                        </p>
                        <p className="text-[9px] uppercase tracking-[0.3em] text-white/30 font-black leading-none">
                            {stat.label}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}
