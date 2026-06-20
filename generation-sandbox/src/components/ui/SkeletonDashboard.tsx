'use client';

import { Skeleton, SkeletonGrid, SkeletonStats, SkeletonHeader, SkeletonFeed } from "./Skeleton";
import { Card } from "./Card";

export function SkeletonDashboard() {
    return (
        <div className="min-h-screen">
            {/* Header placeholder */}
            <div className="h-16 border-b border-white/5 bg-black/50 backdrop-blur-md flex items-center px-6 justify-between sticky top-0 z-50">
                <Skeleton className="h-6 w-40" />
                <div className="flex gap-4">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 py-8 space-y-12">
                {/* Hero / Welcome section */}
                <div className="space-y-4">
                    <Skeleton className="h-10 w-1/3" />
                    <Skeleton className="h-5 w-1/2" />
                </div>

                {/* Stats row */}
                <div className="space-y-4">
                    <Skeleton className="h-6 w-24" />
                    <SkeletonStats count={4} />
                </div>

                {/* Categories / Quick Actions */}
                <div className="flex gap-4 overflow-hidden">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-32 rounded-xl shrink-0" />
                    ))}
                </div>

                {/* Content Sections */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    <div className="lg:col-span-2 space-y-8">
                        <Skeleton className="h-8 w-48" />
                        <SkeletonGrid count={6} columns={3} />
                    </div>

                    <div className="space-y-8">
                        <Skeleton className="h-8 w-40" />
                        <div className="space-y-4">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <Card key={i} className="p-4 border-white/5 bg-white/[0.02]">
                                    <div className="flex gap-3">
                                        <Skeleton className="h-12 w-12 rounded-lg shrink-0" />
                                        <div className="flex-1 space-y-2">
                                            <Skeleton className="h-3 w-3/4" />
                                            <Skeleton className="h-3 w-1/2" />
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
