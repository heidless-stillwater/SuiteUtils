'use client';

import { useGallery } from './useGallery';
import { useAuth } from '@/lib/auth-context';
import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import GlobalSearch from '@/components/GlobalSearch';
import GallerySidebar from '@/components/gallery/GallerySidebar';
import GalleryToolbar from '@/components/gallery/GalleryToolbar';
import GalleryGrid from '@/components/gallery/GalleryGrid';
import ImageDetailModal from '@/components/gallery/ImageDetailModal';
import ImageGroupModal from '@/components/gallery/ImageGroupModal';
import ConfirmationModal from '@/components/ConfirmationModal';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Icons } from '@/components/ui/Icons';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import { Suspense } from 'react';

function GalleryContent() {
    const gallery = useGallery();
    const searchParams = useSearchParams();
    const router = useRouter();

    const {
        user, profile, credits, availableCredits, 
        effectiveRole, switchRole, setAudienceMode, 
        signOut, authLoading,
        fetchImages,
        fetchCollections,
        images,
        loadingImages,
        selectedGroup,
        selectedImage,
        confirmationState,
        confirmDelete,
        cancelDelete
    } = gallery;

    useEffect(() => {
        let unsubscribeCollections: (() => void) | undefined;
        
        if (user) {
            fetchImages();
            unsubscribeCollections = fetchCollections();
        }
        
        return () => {
            if (unsubscribeCollections) unsubscribeCollections();
        };
    }, [user, fetchImages, fetchCollections]);

    // Handle deep-linking to a specific variation set
    useEffect(() => {
        const setId = searchParams.get('set');
        if (setId && images.length > 0 && !selectedGroup) {
            const group = images.filter(img => img.promptSetID === setId);
            if (group.length > 0) {
                gallery.setSelectedGroup(group);
            }
        }
    }, [searchParams, images, selectedGroup, gallery]);

    // Handle deep-linking to a specific image
    useEffect(() => {
        const imageId = searchParams.get('imageId');
        if (imageId && images.length > 0 && !selectedImage) {
            const image = images.find(img => img.id === imageId);
            if (image) {
                gallery.setSelectedImage(image);
            }
        }
    }, [searchParams, images, selectedImage, gallery]);

    if (authLoading) {
        return <div className="min-h-screen flex items-center justify-center"><Icons.spinner className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    if (!user || !profile) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p>Please log in to view your gallery.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-white">
            <DashboardHeader
                user={user}
                profile={profile}
                credits={credits}
                availableCredits={availableCredits}
                isAdminOrSu={gallery.isAdmin}
                effectiveRole={effectiveRole}
                switchRole={switchRole}
                setAudienceMode={setAudienceMode}
                signOut={signOut}
            />
            <div className="max-w-[1920px] mx-auto px-4 md:px-8 py-12 flex flex-col lg:flex-row gap-8">
                {/* Collection Sidebar */}
                <GallerySidebar
                    collections={gallery.collections}
                    selectedCollectionId={gallery.selectedCollectionId}
                    onSelectCollection={gallery.setSelectedCollectionId}
                    onCreateCollection={() => gallery.setShowCreateCollection(true)}
                    
                    // Filter Props
                    filterQuality={gallery.filterQuality}
                    onFilterQualityChange={gallery.setFilterQuality}
                    filterAspectRatio={gallery.filterAspectRatio}
                    onFilterAspectRatioChange={gallery.setFilterAspectRatio}
                    filterTag={gallery.filterTag}
                    onFilterTagChange={gallery.setFilterTag}
                    filterExemplar={gallery.filterExemplar}
                    onFilterExemplarChange={gallery.setFilterExemplar}
                    filterCommunity={gallery.filterCommunity}
                    onFilterCommunityChange={gallery.setFilterCommunity}

                    // Collapse Props
                    isCollapsed={gallery.isSidebarCollapsed}
                    onToggleCollapse={() => gallery.setIsSidebarCollapsed(!gallery.isSidebarCollapsed)}
                />

                <main className="flex-1 min-w-0">
                    <div className="flex flex-col gap-6">
                        {/* Header */}
                        {/* Dashboard-style Hero Header */}
                        <div className="mb-8 p-8 rounded-3xl border border-primary/20 bg-primary/5 shadow-[inset_0_0_40px_rgba(var(--primary-rgb),0.05)] relative overflow-hidden group">
                            {/* Subtle background glow */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[100px] -mr-32 -mt-32 group-hover:bg-primary/20 transition-all duration-1000" />
                            
                            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                                <div className="space-y-4 text-center md:text-left">
                                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                                        <Badge variant="primary" className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-primary text-white">
                                            Studio Archive
                                        </Badge>
                                        <Badge variant="secondary" className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-white/10 text-white/60 border-white/10">
                                            {gallery.filteredImages.length} Assets
                                        </Badge>
                                    </div>
                                    <div className="space-y-1">
                                        <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white leading-none">
                                            Prompt <span className="text-primary">Gallery</span>
                                        </h1>
                                        <p className="text-white/40 max-w-xl text-lg font-medium leading-relaxed italic">
                                            {gallery.viewMode === 'personal' 
                                                ? 'Manage and organize your generated masterpieces within your personal cloud vault.' 
                                                : gallery.viewMode === 'admin' 
                                                ? 'Review and manage the ecosystem-wide asset flow from the central authority console.'
                                                : 'Explore the collective creative output of the entire Stillwater community.'}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-4">
                                        <Link
                                            href="/dashboard"
                                            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-primary transition-all group px-4 py-2 rounded-xl bg-black/40 border border-white/5 hover:border-primary/30"
                                        >
                                            <Icons.arrowLeft size={12} className="group-hover:-translate-x-1 transition-transform" />
                                            Return to Dashboard
                                        </Link>
                                        <Link
                                            href="/community"
                                            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-primary transition-all group px-4 py-2 rounded-xl bg-black/40 border border-white/5 hover:border-primary/30"
                                        >
                                            <Icons.users size={12} />
                                            Community Hub
                                        </Link>
                                    </div>
                                </div>
                                
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
                                    <div className="w-full sm:w-72 lg:w-96">
                                        <GlobalSearch />
                                    </div>
                                    {gallery.viewMode === 'personal' && (
                                        <button
                                            id="new-image-set-btn"
                                            onClick={() => router.push('/generate')}
                                            className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-black text-[12px] uppercase tracking-[0.2em] text-white overflow-hidden transition-all duration-300 shadow-[0_10px_30px_rgba(var(--primary-rgb),0.3)] hover:scale-[1.05] active:scale-[0.95] whitespace-nowrap whitespace-nowrap bg-brand-gradient"
                                        >
                                            <Icons.plus size={18} className="flex-shrink-0 group-hover:rotate-90 transition-transform duration-500" />
                                            New Generation
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Toolbar */}
                        <GalleryToolbar
                            viewMode={gallery.viewMode}
                            setViewMode={gallery.setViewMode}
                            isSu={gallery.isSu}
                            isGrouped={gallery.isGrouped}
                            onToggleGrouped={() => gallery.setIsGrouped(!gallery.isGrouped)}
                            selectionMode={gallery.selectionMode}
                            onToggleSelectionMode={() => gallery.setSelectionMode(!gallery.selectionMode)}
                            onClearSelection={() => gallery.setSelectedImageIds(new Set())}
                            sortMode={gallery.sortMode}
                            onSortChange={gallery.setSortMode}
                            gridDensity={gallery.gridDensity}
                            onGridDensityChange={gallery.setGridDensity}
                        />


                        {/* Batch Action Bar */}
                        {gallery.selectionMode && gallery.selectedImageIds.size > 0 && (
                            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-8 duration-500">
                                <div className="flex items-center gap-6 px-6 py-4 shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 bg-[#0a0a0e] rounded-2xl ring-1 ring-black/50">
                                    <div className="flex items-center gap-3 pr-6 border-r border-white/10">
                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white font-black text-sm shadow-lg shadow-primary/20 animate-in zoom-in duration-300">
                                            {gallery.selectedImageIds.size}
                                        </div>
                                        <span className="text-sm font-black uppercase tracking-widest text-white opacity-80">Selected</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => {
                                                const allIds = new Set(gallery.images.map(img => img.id));
                                                gallery.setSelectedImageIds(allIds);
                                            }}
                                            className="h-9 px-4 text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 text-white border-white/10 border"
                                        >
                                            Select All
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => gallery.setSelectedImageIds(new Set())}
                                            className="h-9 px-4 text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 text-white border-white/10 border"
                                        >
                                            Clear
                                        </Button>
                                        <div className="w-px h-6 bg-white/10 mx-1" />
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            onClick={gallery.handleBatchDelete}
                                            disabled={gallery.batchDeleting}
                                            isLoading={gallery.batchDeleting}
                                            className="!bg-error hover:!bg-error/80 text-white h-9 px-6 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-error/20 border-0"
                                        >
                                            <Icons.delete size={14} className="mr-2" />
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Grid */}
                        <GalleryGrid
                            images={gallery.images}
                            filteredImages={gallery.filteredImages}
                            loadingImages={gallery.loadingImages}
                            loadingMore={gallery.loadingMore}
                            hasMore={gallery.hasMore}
                            isGrouped={gallery.isGrouped}
                            gridDensity={gallery.gridDensity}
                            groupImagesByPromptSet={gallery.groupImagesByPromptSet}

                            onLoadMore={() => gallery.fetchImages(true)}
                            selectionMode={gallery.selectionMode}
                            selectedImageIds={gallery.selectedImageIds}
                            deletingId={gallery.deletingId}
                            onImageSelect={gallery.setSelectedImage}
                            onGroupSelect={gallery.setSelectedGroup}
                            onToggleImageSelection={(id: string) => {
                                gallery.setSelectedImageIds(prev => {
                                    const newSet = new Set(prev);
                                    if (newSet.has(id)) newSet.delete(id);
                                    else newSet.add(id);
                                    return newSet;
                                });
                            }}
                            onToggleGroupSelection={(ids: string[]) => {
                                gallery.setSelectedImageIds(prev => {
                                    const newSet = new Set(prev);
                                    const allSelected = ids.every(id => newSet.has(id));
                                    if (allSelected) ids.forEach(id => newSet.delete(id));
                                    else ids.forEach(id => newSet.add(id));
                                    return newSet;
                                });
                            }}
                            onDeleteImage={gallery.handleDelete}
                            onClearFilters={() => {
                                gallery.setSearchQuery('');
                                gallery.setFilterQuality('all');
                                gallery.setFilterAspectRatio('all');
                                gallery.setFilterTag('all');
                                gallery.setSelectedCollectionId(null);
                                gallery.setFilterExemplar(false);
                                gallery.setFilterCommunity(false);
                                gallery.setSortMode('newest');
                            }}
                        />
                    </div>
                </main>
            </div>

            {/* Modals */}
            {selectedImage && (
                <ImageDetailModal
                    selectedImage={selectedImage}
                    onClose={() => gallery.setSelectedImage(null)}
                    onNext={gallery.handleNextImage}
                    onPrev={gallery.handlePrevImage}
                    collections={gallery.collections}
                    onUpdate={gallery.handleUpdateImage}
                    onDelete={gallery.handleDelete}
                    deletingId={gallery.deletingId}
                />
            )}

            {selectedGroup && !selectedImage && (
                <ImageGroupModal
                    selectedGroup={selectedGroup}
                    onClose={() => {
                        gallery.setSelectedGroup(null);
                        gallery.setSelectedImageIds(new Set()); // Reset selection on close
                        if (searchParams.get('set')) {
                            router.replace('/gallery', { scroll: false });
                        }
                    }}
                    onImageSelect={gallery.setSelectedImage}
                    collections={gallery.collections}
                    onBatchToggleCollection={gallery.handleBatchToggleCollection}
                    showCreateCollection={gallery.showCreateCollection}
                    setShowCreateCollection={gallery.setShowCreateCollection}
                    newCollectionName={gallery.newCollectionName}
                    setNewCollectionName={gallery.setNewCollectionName}
                    onCreateCollection={gallery.handleCreateCollection}
                    creatingCollection={gallery.creatingCollection}
                    collectionError={gallery.collectionError}
                    setCollectionError={gallery.setCollectionError}
                    // Variation Management
                    selectedImageIds={gallery.selectedImageIds}
                    onToggleImageSelection={(id: string) => {
                        gallery.setSelectedImageIds(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(id)) newSet.delete(id);
                            else newSet.add(id);
                            return newSet;
                        });
                    }}
                    onToggleAll={() => {
                        const allIds = selectedGroup.map(img => img.id);
                        const isAllSelected = allIds.every(id => gallery.selectedImageIds.has(id));
                        
                        gallery.setSelectedImageIds(prev => {
                            const newSet = new Set(prev);
                            if (isAllSelected) {
                                allIds.forEach(id => newSet.delete(id));
                            } else {
                                allIds.forEach(id => newSet.add(id));
                            }
                            return newSet;
                        });
                    }}
                    onBatchDelete={gallery.handleBatchDelete}
                    onDeleteSingle={(id: string) => gallery.handleDelete(id)}
                    onBatchUpdateTitle={gallery.handleBatchUpdateTitle}
                />
            )}

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={!!confirmationState}
                title={confirmationState?.type === 'batch' ? 'Delete Images' : 'Delete Image'}
                message={confirmationState?.type === 'batch'
                    ? `Are you sure you want to delete ${gallery.selectedImageIds.size} images? This action cannot be undone.`
                    : 'Are you sure you want to delete this image? This action cannot be undone.'}
                confirmLabel="Delete"
                cancelLabel="Cancel"
                onConfirm={confirmDelete}
                onCancel={cancelDelete}
                type="danger"
                isLoading={gallery.deletingId !== null || gallery.batchDeleting}
            />

            {/* Unpublish Confirmation Modal */}
            <ConfirmationModal
                isOpen={!!gallery.unpublishConfirmImage}
                title="Remove from Community Hub"
                message="Are you sure you want to remove this image from the Community Hub? This will delete all associated votes and comments."
                confirmLabel="Remove from Hub"
                cancelLabel="Keep it"
                onConfirm={gallery.confirmUnpublish}
                onCancel={() => gallery.setUnpublishConfirmImage(null)}
                type="danger"
                isLoading={gallery.publishingId !== null}
            />
        </div>
    );
}

export default function GalleryPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <Icons.spinner className="w-8 h-8 animate-spin text-primary" />
            </div>
        }>
            <GalleryContent />
        </Suspense>
    );
}
