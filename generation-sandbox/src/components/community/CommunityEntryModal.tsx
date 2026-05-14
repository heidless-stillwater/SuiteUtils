'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CommunityEntry, BADGES, CommunityComment } from '@/lib/types';
import { formatDate } from '@/lib/date-utils';
import ReactionPicker from '@/components/ReactionPicker';
import ShareButtons from '@/components/ShareButtons';
import ConfirmationModal from '@/components/ConfirmationModal';
import CommentSection from './CommentSection';
import Tooltip from '@/components/Tooltip';
import { Button } from '@/components/ui/Button';
import { Icons } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';
import CollectionSelector from '@/components/gallery/image-detail/CollectionSelector';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/Toast';
import TagManager from '@/components/gallery/image-detail/TagManager';
import { modalSlideUp, backdropFade } from '@/lib/animations';

interface CommunityEntryModalProps {
    entry: CommunityEntry;
    onClose: () => void;
    user: any;
    userRole?: string;
    onVote: (id: string) => void;
    isVoting: boolean;
    isFollowing: boolean;
    onToggleFollow: () => void;
    followLoading: boolean;
    comments: CommunityComment[];
    loadingComments: boolean;
    onAddComment: (text: string) => Promise<void>;
    onDeleteComment: (id: string) => Promise<void>;
    onReact: (id: string, emoji: string) => void;
    reactingEmoji?: string | null;
    onReport: (id: string) => Promise<void>;
    collections?: any[];
    onToggleCollection?: (collectionId: string) => Promise<void>;
    onCreateCollection?: (name: string) => Promise<any>;
    onUnpublish?: () => Promise<void>;
    isUnpublishing?: boolean;
    onFilterUser?: (userId: string, userName: string) => void;
    onShare?: (entryId: string) => void;
    viewerCollectionIds?: string[];
    loadingViewerCollections?: boolean;
    onAddTag?: (tag: string) => Promise<void>;
    onRemoveTag?: (tag: string) => Promise<void>;
    onUpdatePromptSetID?: (newId: string) => Promise<void>;
    isAdmin?: boolean;
    onToggleExemplar?: () => Promise<void>;
    onUpdateTitle?: (newTitle: string) => Promise<void>;
}

export default function CommunityEntryModal({
    entry,
    onClose,
    user,
    userRole,
    onVote,
    isVoting,
    isFollowing,
    onToggleFollow,
    followLoading,
    comments,
    loadingComments,
    onAddComment,
    onDeleteComment,
    onReact,
    reactingEmoji,
    onReport,
    collections,
    onToggleCollection,
    onCreateCollection,
    onUnpublish,
    isUnpublishing,
    onFilterUser,
    onShare,
    viewerCollectionIds = [],
    loadingViewerCollections = false,
    onAddTag,
    onRemoveTag,
    onUpdatePromptSetID,
    isAdmin,
    onToggleExemplar,
    onUpdateTitle
}: CommunityEntryModalProps) {
    const router = useRouter();
    const { showToast } = useToast();
    const [isSharing, setIsSharing] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [isReporting, setIsReporting] = useState(false);
    const [error, setError] = useState(false);
    const [newTag, setNewTag] = useState('');
    const [isUpdatingTags, setIsUpdatingTags] = useState(false);
    const [isUpdatingPromptSetID, setIsUpdatingPromptSetID] = useState(false);
    const [isEditingBatch, setIsEditingBatch] = useState(false);
    const [batchValue, setBatchValue] = useState('');
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [titleValue, setTitleValue] = useState(entry.title || '');
    const [isSavingTitle, setIsSavingTitle] = useState(false);

    const handleSaveTitle = async () => {
        if (!titleValue.trim() || !onUpdateTitle) return;
        setIsSavingTitle(true);
        try {
            await onUpdateTitle(titleValue.trim());
            setIsEditingTitle(false);
        } finally {
            setIsSavingTitle(false);
        }
    };

    const handleConfirmReport = async () => {
        setIsReporting(true);
        try {
            await onReport(entry.id);
            setShowReportModal(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsReporting(false);
        }
    };

    const hasVoted = user && entry.votes?.[user.uid];

    return (
        <motion.div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            variants={backdropFade}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={onClose}
        >
            <motion.div
                className="bg-background rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-white/10"
                variants={modalSlideUp}
                initial="initial"
                animate="animate"
                exit="exit"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex flex-col lg:flex-row min-h-0 flex-1">
                    {/* Image / Video */}
                    <div className="flex-1 bg-background-secondary flex items-center justify-center p-4 overflow-hidden min-h-[300px] relative">
                        {(() => {
                            if (error) {
                                return (
                                    <div className="flex flex-col items-center justify-center text-foreground-muted">
                                        <Icons.error className="w-16 h-16 opacity-20 mb-3" />
                                        <span className="text-xs font-black uppercase tracking-widest opacity-40">Media Unavailable</span>
                                    </div>
                                );
                            }
                            const isVid = !!(entry.videoUrl || entry.settings?.modality === 'video');
                            if (isVid) {
                                return (
                                    <video
                                        src={entry.videoUrl || entry.imageUrl}
                                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                                        controls
                                        loop
                                        muted
                                        playsInline
                                        preload="auto"
                                        onError={() => setError(true)}
                                    />
                                );
                            }
                            return (
                                <img
                                    src={entry.imageUrl}
                                    alt={entry.prompt}
                                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                                    onError={() => setError(true)}
                                />
                            );
                        })()}
                    </div>

                    {/* Right Panel */}
                    <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-border flex flex-col min-h-0 bg-background/50">
                        {/* Header */}
                        <div className="p-4 border-b border-border flex justify-between items-start bg-card/50">
                            <Link
                                href={`/profile/${entry.originalUserId}`}
                                className="flex items-center gap-3 hover:opacity-80 transition-opacity group/modal-author"
                            >
                                {entry.authorPhotoURL && entry.authorPhotoURL !== 'null' ? (
                                    <img
                                        src={entry.authorPhotoURL}
                                        alt={entry.authorName || 'User'}
                                        className="w-10 h-10 rounded-full border-2 border-primary shadow-sm"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-lg font-bold text-primary border-2 border-primary/20 group-hover/modal-author:border-primary transition-colors">
                                        {(entry.authorName || 'A').charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold group-hover/modal-author:text-primary transition-colors">{entry.authorName}</p>
                                        <div className="flex gap-1">
                                            {(entry.authorBadges || []).map(badgeId => (
                                                <Tooltip key={badgeId} content={BADGES[badgeId]?.label || 'Award'}>
                                                    <span className="text-sm">
                                                        {BADGES[badgeId]?.icon}
                                                    </span>
                                                </Tooltip>
                                            ))}
                                        </div>
                                    </div>
                                    <p className="text-xs text-foreground-muted">{formatDate(entry.publishedAt)}</p>
                                </div>
                            </Link>

                            <div className="flex items-center gap-2 ml-auto mr-4">
                                {onFilterUser && (
                                    <Tooltip content={`Filter feed by ${entry.authorName}`}>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                onFilterUser(entry.originalUserId, entry.authorName);
                                                onClose();
                                            }}
                                            className="h-8 px-2 text-[10px] font-black uppercase tracking-widest text-primary/60 hover:text-primary hover:bg-primary/5 gap-2"
                                        >
                                            <Icons.filter size={14} />
                                            <span className="hidden sm:inline">Filter Feed</span>
                                        </Button>
                                    </Tooltip>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                {user && user.uid !== entry.originalUserId && (
                                    <Tooltip content={isFollowing ? 'Unfollow' : 'Follow'} position="bottom">
                                        <Button
                                            onClick={onToggleFollow}
                                            isLoading={followLoading}
                                            size="sm"
                                            variant={isFollowing ? 'secondary' : 'primary'}
                                            className="uppercase text-[10px] tracking-widest px-3 py-1 font-black"
                                        >
                                            {isFollowing ? 'Following' : 'Follow'}
                                        </Button>
                                    </Tooltip>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onClose}
                                    className="p-1 hover:bg-background-secondary rounded-lg"
                                >
                                    <Icons.close size={20} />
                                </Button>
                            </div>
                        </div>

                        {/* Unpublish Warning for Creator/Admin */}
                        {(user && (user.uid === entry.originalUserId || userRole === 'admin' || userRole === 'su')) && onUnpublish && (
                            <div className="px-4 py-2 bg-error/5 border-b border-error/10 flex items-center justify-between group/unpublish">
                                <div className="flex items-center gap-2 text-error/70">
                                    <Icons.alert size={14} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Creator Tools</span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onUnpublish}
                                    isLoading={isUnpublishing}
                                    className="h-7 px-2 text-[9px] font-black uppercase tracking-widest text-error/50 hover:text-error hover:bg-error/10 border border-transparent hover:border-error/20 transition-all"
                                >
                                    <Icons.delete size={12} className="mr-1" />
                                    Remove from Hub
                                </Button>
                            </div>
                        )}

                        {/* Scrollable content */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                            {/* Title */}
                            <div className="space-y-1 pb-2 border-b border-white/5 group/title">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] text-primary/60 uppercase tracking-[0.2em] font-black">Neural Identity</label>
                                    {onUpdateTitle && (user?.uid === entry.originalUserId || isAdmin) && !isEditingTitle && (
                                        <button
                                            onClick={() => { setTitleValue(entry.title || ''); setIsEditingTitle(true); }}
                                            className="opacity-0 group-hover/title:opacity-100 text-[10px] font-black uppercase tracking-widest text-primary transition-opacity"
                                        >
                                            Edit
                                        </button>
                                    )}
                                </div>
                                {isEditingTitle ? (
                                    <div className="flex flex-col gap-2">
                                        <input
                                            type="text"
                                            value={titleValue}
                                            onChange={(e) => setTitleValue(e.target.value)}
                                            placeholder="Enter neural identity..."
                                            className="w-full bg-background-secondary border border-border rounded-lg px-3 py-2 text-sm font-black uppercase focus:outline-none focus:ring-1 focus:ring-primary text-white"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSaveTitle();
                                                if (e.key === 'Escape') setIsEditingTitle(false);
                                            }}
                                        />
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                onClick={handleSaveTitle}
                                                isLoading={isSavingTitle}
                                                className="h-8 text-[9px] font-black uppercase tracking-widest"
                                            >
                                                Save
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setIsEditingTitle(false)}
                                                className="h-8 text-[9px] font-black uppercase tracking-widest"
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <h3 className="text-lg font-black text-white uppercase tracking-wider truncate">
                                        {entry.title || '<no title>'}
                                    </h3>
                                )}
                            </div>

                            {/* Prompt */}
                            <div className="space-y-1 group/prompt relative">
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] text-foreground-muted uppercase tracking-widest font-black">Prompt</label>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(entry.prompt);
                                            showToast('Prompt copied to clipboard', 'success');
                                        }}
                                        className="text-[10px] font-black uppercase tracking-widest text-primary opacity-0 group-hover/prompt:opacity-100 transition-opacity hover:text-primary/80"
                                    >
                                        Copy Prompt
                                    </button>
                                </div>
                                <p className="text-sm leading-relaxed text-foreground/90">{entry.prompt}</p>

                                <Tooltip content="Create variation" className="w-full mt-2">
                                    <Button
                                        onClick={() => {
                                            router.push(`/generate?ref=${entry.id}`);
                                        }}
                                        variant="outline"
                                        size="sm"
                                        className="w-full gap-2 font-black uppercase text-[10px] tracking-widest text-primary border-primary/20 hover:border-primary/40 bg-primary/5 hover:bg-primary/10 transition-all h-9"
                                    >
                                        <Icons.variation className="w-3.5 h-3.5" />
                                        <span>Generate Variation</span>
                                    </Button>
                                </Tooltip>
                            </div>

                            {/* Settings */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] text-foreground-muted uppercase tracking-widest font-black">Quality</label>
                                    <p className="text-sm font-medium capitalize">{entry.settings.quality}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-foreground-muted uppercase tracking-widest font-black">Aspect</label>
                                    <p className="text-sm font-medium">{entry.settings.aspectRatio}</p>
                                </div>
                                {entry.promptSetID || (user && user.uid === entry.originalUserId && onUpdatePromptSetID) ? (
                                    <div className="space-y-1 col-span-2 group/batch">
                                        <label className="text-[10px] text-foreground-muted uppercase tracking-widest font-black flex items-center justify-between">
                                            Batch ID
                                            {user && user.uid === entry.originalUserId && onUpdatePromptSetID && !isEditingBatch && (
                                                <button
                                                    onClick={() => {
                                                        setBatchValue(entry.promptSetID || '');
                                                        setIsEditingBatch(true);
                                                    }}
                                                    className="opacity-0 group-hover/batch:opacity-100 text-primary transition-opacity"
                                                >
                                                    Edit
                                                </button>
                                            )}
                                        </label>
                                        {isEditingBatch ? (
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={batchValue}
                                                    onChange={(e) => setBatchValue(e.target.value)}
                                                    className="flex-1 bg-background-secondary border border-border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-primary"
                                                    autoFocus
                                                />
                                                <Button
                                                    size="sm"
                                                    onClick={async () => {
                                                        setIsUpdatingPromptSetID(true);
                                                        try {
                                                            await onUpdatePromptSetID?.(batchValue);
                                                            setIsEditingBatch(false);
                                                        } finally {
                                                            setIsUpdatingPromptSetID(false);
                                                        }
                                                    }}
                                                    isLoading={isUpdatingPromptSetID}
                                                    className="h-8 text-[9px] font-black uppercase tracking-widest"
                                                >
                                                    Save
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setIsEditingBatch(false)}
                                                    className="h-8 text-[9px] font-black uppercase tracking-widest"
                                                >
                                                    Cancel
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <p className="text-[11px] font-mono text-foreground-muted truncate bg-background-secondary rounded px-2 py-0.5 border border-border/50 max-w-[240px]">
                                                    {entry.promptSetID || 'No Batch ID'}
                                                </p>
                                                {entry.promptSetID && (
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(entry.promptSetID!);
                                                            showToast('Batch ID copied', 'success');
                                                        }}
                                                        className="text-foreground-muted hover:text-primary transition-colors"
                                                        title="Copy Batch ID"
                                                    >
                                                        <Icons.copy size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : null}
                            </div>

                            {/* Collections Section */}
                            {user && collections && onToggleCollection && onCreateCollection ? (
                                <div className="space-y-2 pt-2 border-t border-border/50">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <Icons.stack size={14} className="text-foreground-muted" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-foreground-muted">
                                                {user.uid === entry.originalUserId ? 'Your Entry Collections' : 'Save to Collection'}
                                            </span>
                                        </div>
                                        {loadingViewerCollections && (
                                            <Icons.spinner size={12} className="animate-spin text-primary" />
                                        )}
                                    </div>

                                    <CollectionSelector
                                        collections={collections}
                                        selectedIds={user.uid === entry.originalUserId ? (entry.collectionIds || []) : viewerCollectionIds}
                                        onToggle={onToggleCollection}
                                        onCreate={onCreateCollection}
                                    />
                                </div>
                            ) : (entry.collectionNames && entry.collectionNames.length > 0) ? (
                                <div className="space-y-2 pt-2 border-t border-border/50">
                                    <label className="text-[10px] text-foreground-muted uppercase tracking-widest font-black block">Author&apos;s Collections</label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {entry.collectionNames.map(name => (
                                            <Badge key={name} variant="outline" className="text-[10px] py-0 px-2 h-5 border-primary/20 bg-primary/5 text-primary">
                                                {name}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            ) : null}

                            {/* Tags */}
                            {(entry.tags && entry.tags.length > 0) || (user && user.uid === entry.originalUserId && onAddTag) ? (
                                <div className="space-y-2 pt-2 border-t border-border/50">
                                    {user && user.uid === entry.originalUserId && onAddTag && onRemoveTag ? (
                                        <TagManager
                                            tags={entry.tags || []}
                                            newTag={newTag}
                                            isUpdating={isUpdatingTags}
                                            onAdd={async () => {
                                                if (!newTag.trim()) return;
                                                setIsUpdatingTags(true);
                                                try {
                                                    await onAddTag(newTag.trim());
                                                    setNewTag('');
                                                } finally {
                                                    setIsUpdatingTags(false);
                                                }
                                            }}
                                            onRemove={async (tag) => {
                                                setIsUpdatingTags(true);
                                                try {
                                                    await onRemoveTag(tag);
                                                } finally {
                                                    setIsUpdatingTags(false);
                                                }
                                            }}
                                            onChangeNewTag={setNewTag}
                                        />
                                    ) : (
                                        <>
                                            <label className="text-[10px] text-foreground-muted uppercase tracking-widest font-black block">Tags</label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {entry.tags?.map(tag => (
                                                    <Badge key={tag} variant="secondary" className="text-[10px] py-0 px-2 h-5 bg-background-secondary border-border/50">
                                                        #{tag}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            ) : null}

                            {/* Exemplar Badge — Admin Only */}
                            {isAdmin && onToggleExemplar && (
                                <div className="pt-2 border-t border-border/50">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={onToggleExemplar}
                                        className={`w-full justify-between h-9 text-[10px] uppercase font-black tracking-widest transition-all ${entry.isExemplar
                                            ? "text-indigo-400 border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10"
                                            : "text-foreground-muted hover:bg-background-secondary"
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Icons.exemplar size={14} className={entry.isExemplar ? "fill-current" : ""} />
                                            <span>Exemplar</span>
                                        </div>
                                        {entry.isExemplar ? "Active" : "Off"}
                                    </Button>
                                </div>
                            )}

                            {/* Vote + Share Actions */}
                            <div className="flex flex-col gap-3 pt-4 border-t border-border/50">
                                <div className="flex items-center gap-3">
                                    <Tooltip content={hasVoted ? 'Remove vote' : 'Vote'} className="flex-1">
                                        <Button
                                            onClick={() => onVote(entry.id)}
                                            isLoading={isVoting}
                                            variant={hasVoted ? 'primary' : 'outline'}
                                            className="w-full gap-2 font-bold"
                                        >
                                            <Icons.heart className={cn("w-5 h-5", hasVoted && "fill-current")} />
                                            <span>{entry.voteCount} {entry.voteCount === 1 ? 'vote' : 'votes'}</span>
                                        </Button>
                                    </Tooltip>
                                    {(entry.variationCount || 0) > 0 && (
                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-secondary/10 text-secondary rounded-lg border border-secondary/20">
                                            <Icons.variation className="w-4 h-4" />
                                            <span className="text-sm font-bold">{entry.variationCount}</span>
                                            <span className="text-[10px] uppercase tracking-wider font-black opacity-60 ml-1">Variations</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <ReactionPicker
                                            entryId={entry.id}
                                            reactions={entry.reactions || {}}
                                            onReact={(emoji) => onReact(entry.id, emoji)}
                                            isReactingEmoji={reactingEmoji}
                                        />
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <ShareButtons
                                            entryId={entry.id}
                                            imageUrl={entry.imageUrl}
                                            prompt={entry.prompt}
                                            onShare={onShare}
                                        />

                                        <Tooltip content="Report" position="left">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setShowReportModal(true)}
                                                className="text-foreground-muted hover:text-error hover:bg-error/10 transition-colors group/report"
                                            >
                                                <Icons.report className="w-5 h-5 group-hover/report:scale-110 transition-transform" />
                                            </Button>
                                        </Tooltip>
                                    </div>
                                </div>
                            </div>

                            {/* Comments Section */}
                            <div className="pt-4 border-t border-border/50">
                                <CommentSection
                                    entryId={entry.id}
                                    comments={comments}
                                    loading={loadingComments}
                                    user={user}
                                    userRole={userRole}
                                    onAddComment={onAddComment}
                                    onDeleteComment={onDeleteComment}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>

            <ConfirmationModal
                isOpen={showReportModal}
                title="Report Content"
                message="Are you sure you want to report this content for moderation? This action will notify our staff to review the entry."
                confirmLabel="Report"
                onConfirm={handleConfirmReport}
                onCancel={() => setShowReportModal(false)}
                isLoading={isReporting}
                type="warning"
            />
        </motion.div>
    );
}
