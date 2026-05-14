'use client';

import { Suspense } from 'react';
import { SkeletonDashboard } from '@/components/ui/SkeletonDashboard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

// Specialized views
import CasualModeView from '@/components/dashboard/member/CasualModeView';
import ProModeView from '@/components/dashboard/member/ProModeView';

import DashboardHeader from '@/components/dashboard/DashboardHeader';

interface MemberDashboardProps {
    dashboardData: any;
}

export default function MemberDashboard({ dashboardData }: MemberDashboardProps) {
    const {
        profile, setAudienceMode, authLoading, user, credits,
        availableCredits, effectiveRole, switchRole, signOut
    } = dashboardData;

    if (authLoading || !profile) {
        return <SkeletonDashboard />;
    }

    const isCasual = profile.audienceMode === 'casual';

    return (
        <div className="min-h-screen bg-background">
            <DashboardHeader
                user={user}
                profile={profile}
                credits={credits}
                availableCredits={availableCredits || 0}
                isAdminOrSu={false}
                effectiveRole={effectiveRole}
                switchRole={switchRole}
                setAudienceMode={setAudienceMode}
                signOut={signOut}
            />

            {/* Mode Switcher - Sticky below the header */}
            <div className="sticky top-[73px] z-40 w-full bg-background/80 backdrop-blur-md border-b border-border shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-foreground-muted">Experience</span>
                        <div className="flex bg-background-secondary rounded-xl p-1 border border-border/50 shadow-inner">
                            <Button
                                variant={isCasual ? 'primary' : 'ghost'}
                                size="sm"
                                onClick={() => setAudienceMode('casual')}
                                className={`px-5 py-1.5 rounded-lg text-[11px] h-8 font-black tracking-widest uppercase transition-all duration-300 ${isCasual
                                    ? 'shadow-[0_0_15px_rgba(99,102,241,0.4)]'
                                    : 'text-foreground-muted hover:text-foreground'
                                    }`}
                            >
                                Casual
                            </Button>
                            <Button
                                variant={!isCasual ? 'primary' : 'ghost'}
                                size="sm"
                                onClick={() => setAudienceMode('professional')}
                                className={`px-5 py-1.5 rounded-lg text-[11px] h-8 font-black tracking-widest uppercase transition-all duration-300 ${!isCasual
                                    ? 'bg-accent shadow-[0_0_15px_rgba(217,70,239,0.4)]'
                                    : 'text-foreground-muted hover:text-foreground'
                                    }`}
                            >
                                Professional
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 py-8">
                <Suspense fallback={<SkeletonDashboard />}>
                    {isCasual ? (
                        <CasualModeView dashboardData={dashboardData} />
                    ) : (
                        <ProModeView dashboardData={dashboardData} />
                    )}
                </Suspense>
            </main>
        </div>
    );
}
