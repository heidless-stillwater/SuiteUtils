'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDashboard } from '@/hooks/useDashboard';
import { CREDIT_COSTS } from '@/lib/types';
import CollectionSelectModal from '@/components/CollectionSelectModal';
import BulkTagModal from '@/components/BulkTagModal';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icons } from '@/components/ui/Icons';

// Sub-components
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import DashboardHero from '@/components/dashboard/DashboardHero';
import DashboardStats from '@/components/dashboard/DashboardStats';
import CreditActivity from '@/components/dashboard/CreditActivity';
import RecentCreations from '@/components/dashboard/RecentCreations';
import CommunityPulse from '@/components/dashboard/CommunityPulse';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { SkeletonDashboard } from '@/components/ui/SkeletonDashboard';

const SuDashboard = dynamic(() => import('@/components/dashboard/SuDashboard'), {
    loading: () => <SkeletonDashboard />,
});

const MemberDashboard = dynamic(() => import('@/components/dashboard/MemberDashboard'), {
    loading: () => <SkeletonDashboard />,
});

function DashboardContent() {
    const dashboardData = useDashboard();
    const { isAdmin, authLoading, user, profile } = dashboardData;

    if (authLoading) {
        return <SkeletonDashboard />;
    }

    if (!user || !profile) return null;

    // Dispatcher logic
    if (isAdmin) {
        return <SuDashboard dashboardData={dashboardData} />;
    }

    return <MemberDashboard dashboardData={dashboardData} />;
}

export default function DashboardPage() {
    return (
        <Suspense fallback={<SkeletonDashboard />}>
            <DashboardContent />
        </Suspense>
    );
}
