'use client';

import { useCollectionDetail } from '@/hooks/useCollectionDetail';
import { useAuth } from '@/lib/auth-context';
import { Collection, GeneratedImage } from '@/lib/types';
import { db } from '@/lib/firebase';
import { doc, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import ShareButtons from '@/components/ShareButtons';
import ImageCard from '@/components/ImageCard';
import ImageDetailModal from '@/components/gallery/ImageDetailModal';
import ConfirmationModal from '@/components/ConfirmationModal';
import { Icons } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

export default function CollectionDetailClient({ id }: { id: string }) {
    const { user } = useAuth();
    const { showToast } = useToast();
    const router = useRouter();

    const {
        collectionData,
        images,
        setImages,
        isLoading,
        isUpdating,
        selectedIds,
        selectionMode,
        setSelectionMode,
        handleRename,
        handleAddTags,
        handleRemoveTag,
        handleTogglePrivacy,
        handleDeleteCollection,
        handleSetCover,
        handleRemoveImages,
        toggleSelection
    } = useCollectionDetail(id);

    const [isRenaming, setIsRenaming] = useState(false);
    const [newName, setNewName] = useState('');
    const [tagInput, setTagInput] = useState('');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null);

    useEffect(() => {
        if (collectionData) {
            setNewName(collectionData.name);
        }
    }, [collectionData]);

    const onRenameSubmit = async () => {
        if (newName.trim() === collectionData?.name) {
            setIsRenaming(false);
            return;
        }
        await handleRename(newName);
        setIsRenaming(false);
    };

    const onAddTagsSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await handleAddTags(tagInput);
        setTagInput('');
    };

    const handleImageDelete = async (imageId: string) => {
        if (!window.confirm('Permanently delete this image from your account?')) return;
        try {
            setImages(prev => prev.filter(img => img.id !== imageId));
            setSelectedImageId(null);
            await deleteDoc(doc(db, 'users', user?.uid || '', 'images', imageId));
            await updateDoc(doc(db, 'users', user?.uid || '', 'collections', id), {
                imageCount: increment(-1)
            });
            showToast('Image deleted permanently', 'success');
        } catch (error) {
            showToast('Failed to delete image', 'error');
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Icons.spinner className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!collectionData) return null;

    return (
        <div className="min-h-screen bg-background pb-32">
            <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">
                {/* Navigation & Header */}
                <div className="space-y-8">
                    <Link href="/collections" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-foreground-muted hover:text-primary transition-colors">
                        <Icons.arrowLeft size={12} /> Return to Collections
                    </Link>

                    <Card variant="glass" className="p-8 md:p-12 rounded-[3rem] border-border/50 relative overflow-hidden">
                        {/* Decorative Background Icon */}
                        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                            <Icons.stack className="w-48 h-48" />
                        </div>

                        <div className="flex flex-col md:flex-row justify-between gap-12 relative z-10">
                            <div className="flex-1 space-y-6">
                                {isRenaming ? (
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        <Input
                                            value={newName}
                                            onChange={e => setNewName(e.target.value)}
                                            className="flex-1 h-12 px-6 text-2xl font-black"
                                            autoFocus
                                            onKeyDown={e => e.key === 'Enter' && onRenameSubmit()}
                                        />
                                        <div className="flex gap-2">
                                            <Button onClick={onRenameSubmit}>Save</Button>
                                            <Button variant="ghost" onClick={() => setIsRenaming(false)}>Cancel</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="group flex items-center gap-4">
                                        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight">{collectionData.name}</h1>
                                        <button
                                            onClick={() => setIsRenaming(true)}
                                            className="w-10 h-10 rounded-xl bg-background-secondary border border-border/50 flex items-center justify-center text-foreground-muted hover:text-primary hover:border-primary/30 transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <Icons.settings size={16} />
                                        </button>
                                    </div>
                                )}

                                <div className="flex flex-wrap gap-4">
                                    <div className="flex items-center gap-2 px-4 py-2 bg-background-secondary/50 rounded-xl border border-border/50">
                                        <Icons.grid size={14} className="text-primary" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">{images.length} Assets</span>
                                    </div>
                                    <button
                                        onClick={handleTogglePrivacy}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all",
                                            collectionData.privacy === 'public'
                                                ? "bg-success/10 border-success/30 text-success hover:bg-success/20"
                                                : "bg-background-secondary border-border/50 text-foreground-muted hover:text-foreground"
                                        )}
                                    >
                                        {collectionData.privacy === 'public' ? <Icons.globe size={14} /> : <Icons.shield size={14} />}
                                        <span className="text-[10px] font-black uppercase tracking-widest">
                                            {collectionData.privacy === 'public' ? 'Public Access' : 'Private Storage'}
                                        </span>
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {collectionData.tags?.map(t => (
                                            <div key={t} className="flex items-center group/tag">
                                                <button
                                                    onClick={() => router.push(`/gallery?tag=${t}`)}
                                                    className="bg-primary/5 text-primary text-[10px] font-black uppercase px-4 py-2 rounded-l-xl border border-border/50 border-r-0 hover:bg-primary/10 transition-all"
                                                >
                                                    #{t}
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveTag(t)}
                                                    className="bg-primary/5 text-primary text-[10px] font-black uppercase px-3 py-2 rounded-r-xl border border-border/50 hover:bg-error hover:text-white transition-all opacity-40 group-hover/tag:opacity-100"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <form onSubmit={onAddTagsSubmit} className="flex gap-2 max-w-md">
                                        <div className="relative flex-1 group">
                                            <Icons.plus className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground-muted group-focus-within:text-primary transition-colors" size={12} />
                                            <Input
                                                value={tagInput}
                                                onChange={e => setTagInput(e.target.value)}
                                                placeholder="Add tags (comma separated)..."
                                                className="pl-10 h-10 text-[10px] font-black uppercase tracking-widest"
                                            />
                                        </div>
                                        <Button type="submit" size="sm" className="h-10 rounded-xl px-6 text-[10px]" variant="secondary">Add</Button>
                                    </form>
                                </div>
                            </div>

                            <div className="flex flex-row md:flex-col gap-3">
                                <Button variant="ghost" onClick={handleTogglePrivacy} className="flex-1 md:flex-none justify-start px-6 h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest gap-3">
                                    {collectionData.privacy === 'public' ? <Icons.shield size={14} /> : <Icons.globe size={14} />}
                                    {collectionData.privacy === 'public' ? 'Restrict' : 'Publish'}
                                </Button>
                                <Button variant="outline" onClick={() => setIsDeleteModalOpen(true)} className="flex-1 md:flex-none justify-start px-6 h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest gap-3 text-error hover:bg-error/5 border-error/20">
                                    <Icons.delete size={14} /> Remove Folder
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Toolbar */}
                <Card variant="glass" className="sticky top-4 z-50 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-border/50 rounded-3xl shadow-2xl">
                    <div className="flex gap-3">
                        <Button
                            variant={selectionMode ? 'primary' : 'secondary'}
                            onClick={() => { setSelectionMode(!selectionMode); }}
                            className="h-11 rounded-xl px-6 text-[10px] font-black uppercase tracking-widest gap-2"
                        >
                            {selectionMode ? <Icons.activity size={14} /> : <Icons.grid size={14} />}
                            {selectionMode ? 'Editing Selection' : 'Batch Actions'}
                        </Button>

                        {selectionMode && selectedIds.size > 0 && (
                            <div className="flex gap-2 animate-in slide-in-from-left-4 duration-300">
                                <Button
                                    variant="danger"
                                    onClick={handleRemoveImages}
                                    isLoading={isUpdating}
                                    className="h-11 rounded-xl px-6 text-[10px] font-black uppercase tracking-widest gap-2"
                                >
                                    <Icons.delete size={14} /> Remove ({selectedIds.size})
                                </Button>
                            </div>
                        )}
                    </div>

                    <Link href="/dashboard">
                        <Button variant="ghost" className="h-11 rounded-xl px-6 text-[10px] font-black uppercase tracking-widest gap-2">
                            <Icons.plus size={14} /> Add Content
                        </Button>
                    </Link>
                </Card>

                {/* Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {images.map(img => (
                        <ImageCard
                            key={img.id}
                            image={img}
                            variant="dashboard"
                            selectionMode={selectionMode}
                            isSelected={selectedIds.has(img.id)}
                            onClick={() => selectionMode ? toggleSelection(img.id) : setSelectedImageId(img.id)}
                            showFooter={false}
                            renderOverlay={(image) => !selectionMode && (
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-6 flex flex-col justify-between items-end">
                                    {collectionData.coverImageUrl === image.imageUrl ? (
                                        <div className="bg-primary text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg border border-white/20">
                                            Current Cover
                                        </div>
                                    ) : <div />}

                                    <div className="w-full space-y-4">
                                        <p className="text-white text-xs line-clamp-2 font-medium opacity-80 leading-relaxed">{image.prompt}</p>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                onClick={(e) => { e.stopPropagation(); handleSetCover(image.imageUrl); }}
                                                size="sm"
                                                variant={collectionData.coverImageUrl === image.imageUrl ? 'primary' : 'outline'}
                                                className="flex-1 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 bg-white/10 border-white/20 hover:bg-white/20"
                                            >
                                                {collectionData.coverImageUrl === image.imageUrl ? <Icons.check size={14} /> : <Icons.image size={14} />}
                                                {collectionData.coverImageUrl === image.imageUrl ? 'Featured' : 'Set Cover'}
                                            </Button>
                                            <ShareButtons imageUrl={image.imageUrl} prompt={image.prompt} className="scale-90" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        />
                    ))}

                    {images.length === 0 && (
                        <div className="col-span-full py-32 text-center space-y-6">
                            <div className="w-20 h-20 bg-background-secondary rounded-3xl flex items-center justify-center mx-auto text-4xl opacity-20">🌫️</div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-black uppercase tracking-tight">Empty Collection</h3>
                                <p className="text-foreground-muted font-medium">This folder currently contains no generated assets.</p>
                            </div>
                            <Link href="/dashboard">
                                <Button className="px-10 h-12 rounded-xl text-[10px]">Generate New Content</Button>
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            {selectedImageId && (() => {
                const selectedImageIndex = images.findIndex(img => img.id === selectedImageId);
                const selectedImage = images[selectedImageIndex];
                if (!selectedImage) return null;

                return (
                    <ImageDetailModal
                        selectedImage={selectedImage}
                        onClose={() => setSelectedImageId(null)}
                        onNext={() => {
                            const nextIndex = (selectedImageIndex + 1) % images.length;
                            setSelectedImageId(images[nextIndex].id);
                        }}
                        onPrev={() => {
                            const prevIndex = (selectedImageIndex - 1 + images.length) % images.length;
                            setSelectedImageId(images[prevIndex].id);
                        }}
                        collections={[]} // Handled inside if needed
                        onUpdate={(updated) => setImages(prev => prev.map(i => i.id === updated.id ? updated : i))}
                        onDelete={handleImageDelete}
                        deletingId={null}
                    />
                );
            })()}

            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                title="Destroy Collection?"
                message={`You are about to permanently remove "${collectionData.name}". The folder will be deleted but your images will remain safe in your main gallery.`}
                confirmLabel="Confirm Deletion"
                cancelLabel="Keep Folder"
                onConfirm={handleDeleteCollection}
                onCancel={() => setIsDeleteModalOpen(false)}
                isLoading={isUpdating}
                type="danger"
            />
        </div>
    );
}
