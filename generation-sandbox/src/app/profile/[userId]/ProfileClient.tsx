'use client';

import Link from 'next/link';
import { useProfile } from '@/hooks/useProfile';
import { Icons } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

// Sub-components
import { useState } from 'react';
import ProfileHero from '@/components/profile/ProfileHero';
import ProfileStats from '@/components/profile/ProfileStats';
import ProfilePortfolio from '@/components/profile/ProfilePortfolio';
import FollowListModal from '@/components/profile/FollowListModal';

export default function ProfileClient() {
    const profile = useProfile();
    const {
        author, images, communityEntries, communityEntryMap, loading, authLoading, queryError, stats,
        isFollowingProfile, followLoadingProfile, selectedEntry,
        currentUser, viewMode, setViewMode, isGrouped, setIsGrouped, showOnlyCommunity, setShowOnlyCommunity,
        handleToggleFollowProfile, formatDate,
        setSelectedEntry,
        comments, loadingComments, votingEntryId,
        isFollowingEntry, followLoadingEntry, reactingEmoji,
        handleVote, handleReactUpdate, handleAddComment, handleDeleteComment, handleReport,
        handleToggleFollowEntry, handleUnpublish, handleToggleCollection, handleCreateCollection,
        unpublishing, userRole,
        collections, viewerCollectionIds, loadingViewerCollections
    } = profile;

    const [followModal, setFollowModal] = useState<{ open: boolean, type: 'followers' | 'following' }>({
        open: false,
        type: 'followers'
    });

    const handleStatClick = (type: 'followers' | 'following') => {
        setFollowModal({ open: true, type });
    };

    if (loading || authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Icons.spinner className="w-10 h-10 animate-spin text-primary" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground-muted">Loading Creator Profile</p>
                </div>
            </div>
        );
    }

    if (!author) return null;

    return (
        <div className="min-h-screen bg-[#0f172a] text-white selection:bg-primary/30 relative overflow-hidden">
            {/* Subtle Ecosystem Gradients */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/5 blur-[120px] rounded-full" />
            </div>
            {/* Header */}
            <Card variant="glass" className="sticky top-0 z-50 border-x-0 border-t-0 rounded-none border-b border-white/5 p-0 bg-[#0f172a]/60 backdrop-blur-2xl">
                <div className="max-w-7xl mx-auto px-4 h-[72px] flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <Link href="/dashboard">
                            <Button variant="secondary" size="icon" className="w-10 h-10 bg-white/5 border-white/10 hover:bg-white/10 transition-all">
                                <Icons.arrowLeft size={18} className="text-white/60" />
                            </Button>
                        </Link>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-brand-gradient p-[1px]">
                                <div className="w-full h-full bg-[#0f172a] rounded-xl flex items-center justify-center">
                                    <Icons.zap className="text-primary w-5 h-5" />
                                </div>
                            </div>
                            <div>
                                <h1 className="text-lg font-black uppercase tracking-tighter leading-none">Stillwater Studio</h1>
                                <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mt-1">Creator Profile</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link href="/dashboard">
                            <Button variant="primary" size="sm" className="h-10 px-6 font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl shadow-primary/20 hover:scale-[1.02] transition-all">
                                Dashboard
                            </Button>
                        </Link>
                    </div>
                </div>
            </Card>

            <main className="max-w-5xl mx-auto px-4 py-8">
                <ProfileHero
                    author={author}
                    currentUser={currentUser}
                    isFollowing={isFollowingProfile}
                    followLoading={followLoadingProfile}
                    onToggleFollow={handleToggleFollowProfile}
                    formatDate={formatDate}
                    stats={{
                        totalVotes: stats.totalVotes,
                        totalEntries: stats.totalEntries
                    }}
                />


                <ProfilePortfolio
                    images={images}
                    communityEntries={communityEntries}
                    communityEntryMap={communityEntryMap}
                    currentUser={currentUser}
                    userRole={userRole}
                    selectedEntry={selectedEntry}
                    setSelectedEntry={setSelectedEntry}
                    queryError={queryError}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    isGrouped={isGrouped}
                    onToggleGrouped={() => setIsGrouped(g => !g)}
                    showOnlyCommunity={showOnlyCommunity}
                    onToggleOnlyCommunity={() => setShowOnlyCommunity(s => !s)}

                    // Interaction props
                    comments={comments}
                    loadingComments={loadingComments}
                    votingEntryId={votingEntryId}
                    isFollowingEntry={isFollowingEntry}
                    followLoadingEntry={followLoadingEntry}
                    onVote={handleVote}
                    onReact={handleReactUpdate}
                    onAddComment={handleAddComment}
                    onDeleteComment={handleDeleteComment}
                    onToggleFollowEntry={handleToggleFollowEntry}
                    onReport={handleReport}
                    onUnpublishEntry={handleUnpublish}
                    isUnpublishingEntry={unpublishing}
                    reactingEmoji={reactingEmoji}
                    collections={collections}
                    viewerCollectionIds={viewerCollectionIds}
                    loadingViewerCollections={loadingViewerCollections}
                    onToggleCollection={handleToggleCollection}
                    onCreateCollection={handleCreateCollection}
                />
            </main>

            <FollowListModal
                isOpen={followModal.open}
                onClose={() => setFollowModal(prev => ({ ...prev, open: false }))}
                userId={author.uid}
                type={followModal.type}
                title={followModal.type === 'followers' ? 'Followers' : 'Following'}
            />
        </div>
    );
}
