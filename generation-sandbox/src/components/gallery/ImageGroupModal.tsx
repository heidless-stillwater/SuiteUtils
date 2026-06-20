import { GeneratedImage, Collection } from '@/lib/types';
import { formatDate } from '@/lib/date-utils';
import React, { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SmartVideo from '@/components/SmartVideo';
import SmartImage from '@/components/SmartImage';
import Link from 'next/link';
import { Icons } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import Tooltip from '@/components/Tooltip';


interface ImageGroupModalProps {
    selectedGroup: GeneratedImage[];
    onClose: () => void;
    onImageSelect: (image: GeneratedImage) => void;
    collections: Collection[];
    onBatchToggleCollection: (images: GeneratedImage[], collectionId: string) => void;
    showCreateCollection: boolean;
    setShowCreateCollection: (value: boolean) => void;
    newCollectionName: string;
    setNewCollectionName: (value: string) => void;
    onCreateCollection: () => void;
    creatingCollection: boolean;
    collectionError: string;
    setCollectionError: (value: string) => void;
    // New Variation Management Props
    selectedImageIds?: Set<string>;
    onToggleImageSelection?: (id: string, e: React.MouseEvent) => void;
    onToggleAll?: () => void;
    onBatchDelete?: () => void;
    onDeleteSingle?: (id: string) => void;
    onBatchUpdateTitle?: (batchImages: GeneratedImage[], newTitle: string) => Promise<boolean>;
}

export default function ImageGroupModal({
    selectedGroup,
    onClose,
    onImageSelect,
    collections,
    onBatchToggleCollection,
    showCreateCollection,
    setShowCreateCollection,
    newCollectionName,
    setNewCollectionName,
    onCreateCollection,
    creatingCollection,
    collectionError,
    setCollectionError,
    selectedImageIds = new Set(),
    onToggleImageSelection,
    onToggleAll,
    onBatchDelete,
    onDeleteSingle,
    onBatchUpdateTitle
}: ImageGroupModalProps) {
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const titleInputRef = useRef<HTMLInputElement>(null);
    
    const [isCollectionDropdownOpen, setIsCollectionDropdownOpen] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [copied, setCopied] = useState(false);
    const [viewMode, setViewMode] = useState<'grid-2' | 'grid-3' | 'grid-4' | 'grid-6' | 'grid-8'>('grid-4');
    
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editingTitle, setEditingTitle] = useState('');
    const [isSavingTitle, setIsSavingTitle] = useState(false);

    const { showToast } = useToast();
    const firstImage = selectedGroup[0];

    useEffect(() => {
        setEditingTitle(firstImage?.title || '');
    }, [firstImage?.title]);

    const handleSaveTitle = async () => {
        if (!onBatchUpdateTitle) return;
        setIsSavingTitle(true);
        try {
            const success = await onBatchUpdateTitle(selectedGroup, editingTitle);
            if (success) {
                setIsEditingTitle(false);
            }
        } finally {
            setIsSavingTitle(false);
        }
    };

    useEffect(() => {
        if (showCreateCollection && inputRef.current) {
            inputRef.current.focus();
        }
    }, [showCreateCollection]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsCollectionDropdownOpen(false);
                setShowCreateCollection(false);
            }
        };

        if (isCollectionDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isCollectionDropdownOpen, setShowCreateCollection]);

    if (!selectedGroup || selectedGroup.length === 0) return null;

    const commonCollectionIds = collections.filter(col =>
        selectedGroup.every(img =>
            (img.collectionIds || (img.collectionId ? [img.collectionId] : [])).includes(col.id)
        )
    ).map(c => c.id);

    return (
        <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-background rounded-2xl max-w-5xl w-full min-h-[28rem] max-h-[90vh] flex flex-col overflow-hidden relative"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="relative z-50 p-4 border-b border-border flex items-center justify-between bg-background">
                    <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2 group/title">
                            <span className="text-primary/60 text-sm font-black uppercase tracking-widest shrink-0 mt-0.5">Title:</span>
                            {!isEditingTitle ? (
                                <h2 className="text-xl font-black uppercase tracking-widest truncate flex items-center gap-2">
                                    <span className={cn(
                                        "truncate", 
                                        !firstImage.title && "opacity-50 italic"
                                    )}>
                                        {firstImage.title || 'Untitled Variation Group'}
                                    </span>
                                    {onBatchUpdateTitle && (
                                        <button
                                            onClick={() => {
                                                setIsEditingTitle(true);
                                                setTimeout(() => titleInputRef.current?.focus(), 50);
                                            }}
                                            className="opacity-0 group-hover/title:opacity-100 p-1 hover:bg-background-secondary rounded-lg transition-alltext-foreground-muted hover:text-primary shrink-0"
                                            title="Edit Title"
                                        >
                                            <Icons.edit size={14} />
                                        </button>
                                    )}
                                </h2>
                            ) : (
                                <div className="flex items-center gap-2 flex-1 max-w-md">
                                    <input
                                        ref={titleInputRef}
                                        value={editingTitle}
                                        onChange={(e) => setEditingTitle(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSaveTitle();
                                            if (e.key === 'Escape') {
                                                setIsEditingTitle(false);
                                                setEditingTitle(firstImage?.title || '');
                                            }
                                        }}
                                        disabled={isSavingTitle}
                                        placeholder="Variation group title..."
                                        className="flex-1 px-3 py-1 bg-background-secondary border border-border text-foreground rounded-lg focus:outline-none focus:border-primary/50 text-sm font-bold disabled:opacity-50"
                                    />
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            onClick={handleSaveTitle}
                                            disabled={isSavingTitle || editingTitle.trim() === (firstImage?.title || '')}
                                            className="p-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            {isSavingTitle ? <Icons.spinner size={14} className="animate-spin" /> : <Icons.check size={14} strokeWidth={3} />}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setIsEditingTitle(false);
                                                setEditingTitle(firstImage?.title || '');
                                            }}
                                            disabled={isSavingTitle}
                                            className="p-1.5 hover:bg-error/10 text-error rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            <Icons.close size={14} strokeWidth={3} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <p className="text-sm text-foreground-muted">
                                {selectedGroup.length} images • {formatDate(firstImage.createdAt)}
                            </p>
                            {collections.filter(c => commonCollectionIds.includes(c.id)).map(col => (
                                <span key={col.id} className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full border border-primary/20">
                                    {col.name}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {onToggleAll && (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={onToggleAll}
                                className="h-9 px-4 text-[10px] font-black uppercase tracking-widest bg-background-secondary hover:bg-background-tertiary"
                            >
                                {selectedImageIds.size === selectedGroup.length ? 'Clear All' : 'Select All'}
                            </Button>
                        )}

                        {selectedImageIds.size > 0 && onBatchDelete && (
                            <div className="flex items-center gap-2 pr-4 border-r border-border animate-in fade-in slide-in-from-right-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                                    {selectedImageIds.size} Selected
                                </span>
                                <Button
                                    variant="danger"
                                    onClick={onBatchDelete}
                                    className="h-9 px-4 text-[10px] font-black uppercase tracking-widest !bg-error hover:!bg-error/80 text-white border-0 shadow-lg shadow-error/20"
                                >
                                    <Icons.delete size={14} className="mr-2 opacity-80" />
                                    Delete Selected
                                </Button>
                            </div>
                        )}

                        <div className="flex items-center gap-1 bg-black/20 p-1 rounded-xl border border-border shadow-inner shrink-0 mr-2">
                            <button 
                                onClick={() => setViewMode('grid-2')} 
                                className={`px-2 py-1 text-[9px] font-black rounded-lg transition-all ${viewMode === 'grid-2' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-foreground-muted hover:text-white hover:bg-background-secondary'}`}
                            >2C</button>
                            <button 
                                onClick={() => setViewMode('grid-3')} 
                                className={`px-2 py-1 text-[9px] font-black rounded-lg transition-all ${viewMode === 'grid-3' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-foreground-muted hover:text-white hover:bg-background-secondary'}`}
                            >3C</button>
                            <button 
                                onClick={() => setViewMode('grid-4')} 
                                className={`px-2 py-1 text-[9px] font-black rounded-lg transition-all ${viewMode === 'grid-4' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-foreground-muted hover:text-white hover:bg-background-secondary'}`}
                            >4C</button>
                            <button 
                                onClick={() => setViewMode('grid-6')} 
                                className={`px-2 py-1 text-[9px] font-black rounded-lg transition-all ${viewMode === 'grid-6' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-foreground-muted hover:text-white hover:bg-background-secondary'}`}
                            >6C</button>
                            <button 
                                onClick={() => setViewMode('grid-8')} 
                                className={`px-2 py-1 text-[9px] font-black rounded-lg transition-all ${viewMode === 'grid-8' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-foreground-muted hover:text-white hover:bg-background-secondary'}`}
                            >8C</button>
                        </div>

                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => setIsCollectionDropdownOpen(!isCollectionDropdownOpen)}
                                className="px-3 py-1.5 bg-background-secondary hover:bg-background-tertiary rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors border border-border flex items-center gap-2"
                            >
                                <Icons.database size={14} />
                                Group to...
                            </button>

                            {isCollectionDropdownOpen && (
                                <div className="absolute right-0 top-full mt-4 w-[22rem] bg-background border border-border rounded-3xl shadow-2xl z-50 p-6 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="mb-4">
                                        <h3 className="text-xl font-bold">Add to Collection</h3>
                                        <p className="text-foreground-muted text-sm mt-1">Select or create a collection to organize these images.</p>
                                    </div>
                                    
                                    <div className="max-h-56 overflow-y-auto custom-scrollbar -mx-2 px-2 space-y-1">
                                        {/* ── Sticky Create Row — always first ── */}
                                        {!showCreateCollection ? (
                                            <button
                                                onClick={() => {
                                                    setShowCreateCollection(true);
                                                    setTimeout(() => inputRef.current?.focus(), 50);
                                                }}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/70 text-primary transition-all duration-200 group mb-1"
                                            >
                                                <div className="w-5 h-5 rounded border-2 border-primary/60 group-hover:border-primary flex items-center justify-center shrink-0 transition-colors">
                                                    <Icons.plus size={12} strokeWidth={3} />
                                                </div>
                                                <span className="text-sm font-bold">New Collection</span>
                                            </button>
                                        ) : (
                                            <div className="space-y-2 mb-1 p-3 rounded-xl border border-primary/30 bg-primary/5">
                                                <input
                                                    ref={inputRef}
                                                    type="text"
                                                    value={newCollectionName}
                                                    onChange={(e) => {
                                                        setNewCollectionName(e.target.value);
                                                        if (collectionError) setCollectionError('');
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') onCreateCollection();
                                                        if (e.key === 'Escape') {
                                                            setShowCreateCollection(false);
                                                            setNewCollectionName('');
                                                        }
                                                    }}
                                                    placeholder="Collection name..."
                                                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm transition-all duration-200 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-foreground-muted"
                                                />
                                                {collectionError && (
                                                    <p className="text-xs text-error px-1">{collectionError}</p>
                                                )}
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setShowCreateCollection(false);
                                                            setNewCollectionName('');
                                                        }}
                                                        className="flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-border hover:bg-background-secondary text-foreground-muted transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={onCreateCollection}
                                                        disabled={creatingCollection || !newCollectionName.trim()}
                                                        className="flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-primary text-white border border-primary/20 hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {creatingCollection ? '...' : 'Create'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* ── Existing Collections ── */}
                                        {collections.map(col => {
                                            const isSelected = commonCollectionIds.includes(col.id);
                                            return (
                                                <label
                                                    key={col.id}
                                                    className={cn(
                                                        "flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors border",
                                                        isSelected ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-background-secondary border-transparent hover:border-border'
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0",
                                                        isSelected ? "bg-primary border-primary text-white" : "border-foreground-muted/50"
                                                    )}>
                                                        {isSelected && <Icons.check size={14} strokeWidth={3} />}
                                                    </div>
                                                    <span className="text-sm font-medium whitespace-normal break-words leading-tight flex-1">{col.name}</span>
                                                    <input
                                                        type="checkbox"
                                                        className="hidden"
                                                        checked={isSelected}
                                                        onChange={() => onBatchToggleCollection(selectedGroup, col.id)}
                                                    />
                                                </label>
                                            );
                                        })}
                                        {collections.length === 0 && !showCreateCollection && (
                                            <div className="py-6 text-center text-sm text-foreground-muted italic bg-background-secondary/50 rounded-xl">
                                                No collections yet — create one above!
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => {
                                const sid = firstImage.promptSetID || firstImage.settings?.promptSetID;
                                router.push(`/generate?ref=${firstImage.id}${sid ? `&sid=${sid}` : ''}`);
                            }}
                            className="px-3 py-1.5 bg-primary text-white hover:bg-primary-hover rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-primary/20 flex items-center gap-2 group"
                        >
                            <Icons.wand size={14} className="group-hover:rotate-12 transition-transform" />
                            Remix Set
                        </button>

                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-background-secondary rounded-xl text-foreground-muted"
                        >
                            <Icons.close size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">

                    <div className={cn(
                        "grid gap-4",
                        viewMode === 'grid-2' ? 'grid-cols-2' :
                        viewMode === 'grid-3' ? 'grid-cols-2 sm:grid-cols-3' :
                        viewMode === 'grid-4' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4' :
                        viewMode === 'grid-6' ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6' :
                        'grid-cols-4 sm:grid-cols-6 md:grid-cols-8'
                    )}>
                        {selectedGroup.map((img) => {
                            const isVideo = !!(img.videoUrl || img.settings?.modality === 'video');
                            const isSelected = selectedImageIds.has(img.id);

                            return (
                                <div
                                    key={img.id}
                                    onClick={() => onImageSelect(img)}
                                    className={cn(
                                        "group relative aspect-square rounded-xl overflow-hidden cursor-pointer transition-all bg-background-secondary border-2",
                                        isSelected ? "border-primary ring-4 ring-primary/10" : "border-transparent hover:border-primary/20"
                                    )}
                                >
                                    {/* Selection Checkbox Overlay */}
                                    <div 
                                        className={cn(
                                            "absolute top-2 left-2 z-[45] w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all bg-black/40 backdrop-blur-sm shadow-lg",
                                            isSelected ? "bg-primary border-primary scale-110" : "border-white/30 opacity-0 group-hover:opacity-100 hover:border-white/60"
                                        )}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onToggleImageSelection?.(img.id, e);
                                        }}
                                    >
                                        {isSelected && <Icons.check size={14} className="text-white" />}
                                    </div>
                                    {/* Variation Badges */}
                                    {/* Management Actions (Top Right) */}
                                    <div className="absolute top-2 right-2 z-30">
                                        {onDeleteSingle && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDeleteSingle(img.id);
                                                }}
                                                className="w-6 h-6 rounded-lg bg-error/90 hover:bg-error text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg backdrop-blur-sm border border-white/20"
                                                title="Delete Variation"
                                            >
                                                <Icons.delete size={12} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Variation Badges (Top Left, offset for checkbox) */}
                                    <div className="absolute top-2 left-10 flex flex-col gap-1.5 z-30 pointer-events-none">
                                        {img.isExemplar && (
                                            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg px-2 py-0.5 shadow-lg border border-indigo-400/40 flex items-center gap-1.5 w-fit" title="Quality Exemplar">
                                                <Icons.exemplar size={10} className="fill-current" />
                                                <span className="text-[8px] font-black uppercase tracking-widest">Exemplar</span>
                                            </div>
                                        )}
                                        {img.publishedToCommunity && (
                                            <div className="bg-yellow-500 text-white rounded-lg px-2 py-0.5 border border-yellow-400/40 shadow-lg shadow-yellow-500/10 flex items-center gap-1.5 w-fit" title="Published to Community Hub">
                                                <Icons.trophy size={10} />
                                                <span className="text-[8px] font-black uppercase tracking-widest">Community</span>
                                            </div>
                                        )}
                                        {img.sourceImageId && (
                                            <div className="px-2 py-0.5 bg-accent text-white rounded-lg flex items-center gap-1.5 w-fit shadow-md border border-white/10 shrink-0">
                                                <Icons.variation size={10} />
                                                <span className="text-[8px] font-black uppercase tracking-widest">Variant</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Title Overlay */}
                                    <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                                        <p className="text-[9px] font-black text-white uppercase tracking-wider truncate leading-tight">
                                            {img.title || '<no title>'}
                                        </p>
                                    </div>

                                    {isVideo ? (
                                        <>
                                            {/(\.(mp4|webm|mov)(\?|$))/i.test(img.imageUrl || '') ? (
                                                <video
                                                    src={`${img.imageUrl}#t=0.1`}
                                                    className="w-full h-full object-cover"
                                                    preload="metadata"
                                                    muted
                                                    playsInline
                                                />
                                            ) : (
                                                <SmartImage
                                                    src={img.imageUrl}
                                                    alt={img.prompt}
                                                    className="w-full h-full object-cover"
                                                    loading="lazy"
                                                />
                                            )}
                                            <SmartVideo
                                                src={img.videoUrl || img.imageUrl}
                                                className="absolute inset-0 w-full h-full object-cover z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                                loop
                                                muted
                                                preload="metadata"
                                                onMouseEnter={(e) => { if (e.currentTarget.paused) e.currentTarget.play().catch(() => { }); }}
                                                onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                                            />
                                        </>
                                    ) : (
                                        <img
                                            src={img.imageUrl}
                                            alt={img.prompt}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    )}

                                    
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 z-40">
                                        <span className="text-white text-[10px] font-black uppercase tracking-widest bg-black/40 px-4 py-2 rounded-full backdrop-blur-md border border-white/20 scale-90 group-hover:scale-100 transition-transform">
                                            View Details
                                        </span>
                                        
                                        {img.publishedToCommunity && (
                                            <Link
                                                href={`/community?entry=${img.communityEntryId || img.leagueEntryId}`}
                                                onClick={(e) => e.stopPropagation()}
                                                className="text-primary text-[9px] font-black uppercase tracking-widest bg-primary/10 px-3 py-1.5 rounded-full backdrop-blur-md border border-primary/30 scale-90 group-hover:scale-100 transition-all hover:bg-primary/20 hover:scale-105 flex items-center gap-1.5"
                                            >
                                                <Icons.external size={10} strokeWidth={3} />
                                                View on Hub
                                            </Link>
                                        )}
                                    </div>

                                    {/* Title Overlay - Always Visible */}
                                    <div className="absolute inset-x-0 bottom-0 p-1 bg-black/60 backdrop-blur-sm z-20 flex items-center justify-center gap-1 overflow-hidden px-1">
                                        <span className="text-[6px] font-black text-white/40 uppercase shrink-0">Title:</span>
                                        <p className="text-[7px] font-black uppercase text-white truncate">
                                            {img.title || '<no title>'}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
